/**
 * Web UI server
 */

import express from 'express';
import cors from 'cors';
import { json, urlencoded } from 'body-parser';
import history from 'connect-history-api-fallback';
import path from 'path';
import fs from 'fs';
import { ServerConfig, getServerUrl } from './config';
import { findAvailablePort } from './utils';
import { serverLogger } from './logger';

/**
 * Error class for server-related errors
 */
export class ServerError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'ServerError';
  }
}

/**
 * Check if we're running in development mode
 */
function isDevelopmentMode(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Start the server
 */
export async function startServer(config: ServerConfig): Promise<{
  close: () => Promise<void>;
  url: string;
}> {
  if (!config.enabled) {
    serverLogger.info('Web UI server is disabled');
    return {
      close: async () => {},
      url: '',
    };
  }

  try {
    // Find an available port if the configured port is not available
    const actualPort = await findAvailablePort(config.port);
    if (actualPort !== config.port) {
      serverLogger.info(`Port ${config.port} is not available, using port ${actualPort} instead`);
      config = { ...config, port: actualPort };
    }

    const app = express();
    
    // Configure middleware
    app.use(cors());
    app.use(json());
    app.use(urlencoded({ extended: true }));
    
    // Add health check endpoint
    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'ok' });
    });
    
    // Use the build directory for static files
    const staticFilesPath = path.resolve(__dirname, '../../dist/ui');
    
    // Check if UI build exists
    const uiBuildExists = fs.existsSync(staticFilesPath) && 
                          fs.existsSync(path.join(staticFilesPath, 'index.html'));
    
    if (uiBuildExists) {
      // Use history API fallback for SPA
      app.use(history());
      
      // Serve static files after the history middleware
      app.use(express.static(staticFilesPath));
      
      serverLogger.info(`Serving static files from ${staticFilesPath}`);
    } else {
      serverLogger.warn(
        `UI build not found at ${staticFilesPath}. ` +
        `Make sure to run 'npm run build' to create the UI files.`
      );
      
      // Serve a fallback message when the UI build doesn't exist
      app.get('*', (req, res) => {
        if (req.path === '/health') return; // Skip health endpoint
        
        res.status(503).send(`
          <html>
            <body style="font-family: sans-serif; padding: 2rem; text-align: center;">
              <h1>Web UI Not Built</h1>
              <p>The web UI files were not found. Please make sure to run:</p>
              <pre>npm run build</pre>
              <p>to create the UI files before starting the server.</p>
            </body>
          </html>
        `);
      });
    }
    
    // Add API routes prefix
    app.use('/api', (req, res, next) => {
      // This will be populated in a future PR
      next();
    });
    
    // Add a catch-all route for SPA (only needed if UI build exists)
    if (uiBuildExists) {
      app.get('*', (req, res) => {
        res.sendFile(path.join(staticFilesPath, 'index.html'));
      });
    }
    
    // Error handling middleware
    app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      serverLogger.error('Server error:', err);
      
      // In development mode, include the error details
      const errorResponse = {
        error: {
          message: 'Internal server error',
          ...(isDevelopmentMode() ? { 
            details: err.message,
            stack: err.stack 
          } : {})
        }
      };
      
      res.status(500).json(errorResponse);
    });
    
    // Start the server with proper error handling
    const serverPromise = new Promise<{ server: ReturnType<typeof app.listen>; url: string }>((resolve, reject) => {
      try {
        const server = app.listen(config.port, config.host, () => {
          const url = getServerUrl(config);
          serverLogger.info(`Server started at ${url}`);
          resolve({ server, url });
        });
        
        server.on('error', (error) => {
          reject(new ServerError(`Failed to start server on ${config.host}:${config.port}`, error));
        });
      } catch (error) {
        reject(new ServerError('Failed to start server', error instanceof Error ? error : undefined));
      }
    });
    
    const { server, url } = await serverPromise;
    
    return {
      close: async () => {
        return new Promise<void>((resolve, reject) => {
          serverLogger.info('Shutting down server...');
          server.close((err) => {
            if (err) {
              serverLogger.error('Error closing server:', err);
              reject(new ServerError('Failed to close server', err));
            } else {
              serverLogger.info('Server closed');
              resolve();
            }
          });
        });
      },
      url,
    };
  } catch (error) {
    throw new ServerError(
      `Failed to start server: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }
}