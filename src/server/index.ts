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
import apiRoutes from './routes/api';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { sessionManager } from './services/SessionManager';
import { WebSocketService } from './services/WebSocketService';
import { createServer } from 'http';
import swaggerUi from 'swagger-ui-express';
import { apiDocumentation } from './docs/api';

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
 * Used in error handler to decide how much information to show
 */
function isDevelopmentMode(): boolean {
  return process.env.NODE_ENV === 'development';
}

// Export for use in other modules
export { isDevelopmentMode };

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
    
    // Set up Swagger documentation UI
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(apiDocumentation));
    
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
    
    // Add API routes
    app.use('/api', apiRoutes);
    
    // Add route not found handler for API routes
    app.use('/api/*', notFoundHandler);
    
    // Add a catch-all route for SPA (only needed if UI build exists)
    if (uiBuildExists) {
      app.get('*', (req, res) => {
        res.sendFile(path.join(staticFilesPath, 'index.html'));
      });
    }
    
    // Use our custom error handling middleware
    app.use(errorHandler);
    
    // Create HTTP server first to attach both Express and Socket.IO
    const httpServer = createServer(app);
    
    // Start the server with proper error handling
    const serverPromise = new Promise<{ server: ReturnType<typeof httpServer.listen>; url: string }>((resolve, reject) => {
      try {
        const server = httpServer.listen(config.port, config.host, () => {
          const url = getServerUrl(config);
          serverLogger.info(`Server started at ${url}`);
          
          // Initialize WebSocketService after server is listening
          WebSocketService.getInstance(httpServer);
          serverLogger.info('WebSocket service initialized');
          
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
        serverLogger.info('Shutting down server...');
        
        // Stop the session manager
        sessionManager.stop();
        
        // Close WebSocket connections
        try {
          const webSocketService = WebSocketService.getInstance();
          await webSocketService.close();
        } catch (error) {
          serverLogger.warn('Error closing WebSocket service:', error);
        }
        
        return new Promise<void>((resolve, reject) => {
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