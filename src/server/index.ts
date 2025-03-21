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
import { LogCategory } from '../utils/logger';

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
      // Add MIME type overrides for modern web assets
      app.use((req, res, next) => {
        // Set correct MIME types for modern web assets
        if (req.path.endsWith('.js')) {
          res.type('application/javascript');
        } else if (req.path.endsWith('.css')) {
          res.type('text/css');
        } else if (req.path.endsWith('.woff2')) {
          res.type('font/woff2');
        } else if (req.path.endsWith('.woff')) {
          res.type('font/woff');
        } else if (req.path.endsWith('.ttf')) {
          res.type('font/ttf');
        }
        next();
      });

      // Use history API fallback for SPA
      app.use(history());
      
      // Serve static files after the history middleware
      app.use(express.static(staticFilesPath, {
        index: ['index.html'],
        etag: true,
        lastModified: true,
        maxAge: config.development ? 0 : '1d', // No cache in dev mode
        setHeaders: (res, path) => {
          // Set cache headers based on file type
          if (path.endsWith('.html')) {
            // Don't cache HTML files
            res.setHeader('Cache-Control', 'no-cache');
          } else if (path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
            // Cache assets with hashed filenames for 1 year
            if (path.match(/\.[0-9a-f]{8}\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            } else {
              // Cache other assets for 1 day in production, no cache in dev
              res.setHeader(
                'Cache-Control', 
                config.development ? 'no-cache' : 'public, max-age=86400'
              );
            }
          }
        }
      }));
      
      serverLogger.info(`Serving static files from ${staticFilesPath}`, LogCategory.STATIC);
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
            <head>
              <title>QCKFX - UI Not Built</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  background-color: #f9f9f9;
                  padding: 2rem;
                  max-width: 800px;
                  margin: 0 auto;
                  text-align: center;
                }
                h1 { color: #e53e3e; margin-bottom: 1rem; }
                pre {
                  background-color: #f1f1f1;
                  padding: 1rem;
                  border-radius: 0.25rem;
                  overflow-x: auto;
                  font-size: 0.9rem;
                  text-align: left;
                  display: inline-block;
                }
                code { font-family: Menlo, Monaco, 'Courier New', monospace; }
                .card {
                  background-color: white;
                  border-radius: 0.5rem;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                  padding: 2rem;
                  margin-top: 2rem;
                }
                .steps { text-align: left; }
                .steps li { margin-bottom: 0.5rem; }
              </style>
            </head>
            <body>
              <h1>Web UI Not Built</h1>
              <p>The web UI files were not found in the expected location.</p>
              
              <div class="card">
                <h2>Quick Fix</h2>
                <p>Run the following command to build the UI:</p>
                <pre><code>npm run build</code></pre>
                
                <div class="steps">
                  <h3>Alternative Steps:</h3>
                  <ol>
                    <li>Install dependencies: <code>npm install</code></li>
                    <li>Build the project: <code>npm run build</code></li>
                    <li>Restart the server</li>
                  </ol>
                </div>
                
                <p>For development, you can also run:</p>
                <pre><code>npm run dev:ui</code></pre>
                <p>This will start a development server with hot reload at <a href="http://localhost:5173">http://localhost:5173</a></p>
              </div>
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