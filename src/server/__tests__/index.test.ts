import { startServer } from '..';
import { ServerConfig } from '../config';
import express from 'express';
import http from 'http';
import { WebSocketService } from '../services/WebSocketService';

// Type definitions for mocks
interface MockApp {
  use: jest.Mock;
  get: jest.Mock;
  listen: jest.Mock;
}

interface MockServer {
  close: jest.Mock;
}

// Mock server that will be returned by listen
const mockServer: MockServer & { on: jest.Mock } = {
  close: jest.fn((cb?: (err?: Error) => void) => {
    if (cb) cb();
  }),
  on: jest.fn().mockImplementation((event: string, callback: (error: Error) => void) => {
    // Store the callback but don't call it (we'll manually test it later)
    return mockServer;
  }),
};

// Mock http.createServer
jest.mock('http', () => {
  return {
    ...jest.requireActual('http'),
    createServer: jest.fn().mockReturnValue({
      listen: jest.fn((port, host, callback) => {
        // Call the callback asynchronously to better simulate real behavior
        if (callback && typeof callback === 'function') {
          setTimeout(callback, 0);
        }
        return mockServer;
      }),
    }),
  };
});

// Mock dependencies
jest.mock('express', () => {
  // Create a mock app
  const mockApp: MockApp = {
    use: jest.fn().mockReturnThis(),
    get: jest.fn().mockReturnThis(),
    listen: jest.fn(() => mockServer),
  };
  
  // Mock app.listen to immediately call its callback
  mockApp.listen.mockImplementation((port, host, callback) => {
    // Call the callback asynchronously to better simulate real behavior
    if (callback && typeof callback === 'function') {
      setTimeout(callback, 0);
    }
    return mockServer;
  });
  
  // Create a mock express factory function
  const mockExpress: any = jest.fn(() => mockApp);
  
  // Add static methods to express
  mockExpress.static = jest.fn();
  mockExpress.json = jest.fn(() => 'jsonMiddleware');
  mockExpress.urlencoded = jest.fn(() => 'urlencodedMiddleware');
  
  return mockExpress;
});

jest.mock('cors', () => jest.fn(() => 'corsMiddleware'));
jest.mock('body-parser', () => ({
  json: jest.fn(() => 'jsonMiddleware'),
  urlencoded: jest.fn(() => 'urlencodedMiddleware'),
}));
jest.mock('connect-history-api-fallback', () => jest.fn(() => 'historyMiddleware'));
jest.mock('../routes/api', () => require('../routes/__tests__/api.mock').default);

jest.mock('../utils', () => ({
  findAvailablePort: jest.fn().mockImplementation(async (port) => port),
  isPortAvailable: jest.fn().mockImplementation(async () => true),
}));

// Mock WebSocketService
jest.mock('../services/WebSocketService', () => {
  return {
    WebSocketService: {
      getInstance: jest.fn().mockImplementation(() => ({
        close: jest.fn().mockResolvedValue(undefined)
      }))
    }
  };
});

jest.mock('../logger', () => ({
  serverLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true), // Default to UI build existing
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
}));

describe('Server', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('startServer', () => {
    test('should return early if server is disabled', async () => {
      const config: ServerConfig = {
        enabled: false,
        port: 3000,
        host: 'localhost',
        development: false,
      };
      
      const result = await startServer(config);
      expect(result).toEqual({
        close: expect.any(Function),
        url: '',
      });
      
      // The server should not be started
      expect(express().listen).not.toHaveBeenCalled();
    });
    
    test('should start the server if enabled', async () => {
      const config: ServerConfig = {
        enabled: true,
        port: 3000,
        host: 'localhost',
        development: false,
      };
      
      // Set a longer timeout for this test
      jest.setTimeout(10000);
      
      const result = await startServer(config);
      expect(result).toEqual({
        close: expect.any(Function),
        url: 'http://localhost:3000',
      });
      
      // Check middleware setup
      expect(express().use).toHaveBeenCalledWith('corsMiddleware');
      expect(express().use).toHaveBeenCalledWith('jsonMiddleware');
      expect(express().use).toHaveBeenCalledWith('urlencodedMiddleware');
      expect(express().use).toHaveBeenCalledWith('historyMiddleware');
      expect(express().use).toHaveBeenCalledWith(expect.any(Function)); // Error handler
      
      // Check routes
      expect(express().get).toHaveBeenCalledWith('/health', expect.any(Function));
      expect(express().get).toHaveBeenCalledWith('*', expect.any(Function));
      
      // Check API routes
      expect(express().use).toHaveBeenCalledWith('/api', expect.any(Function));
      
      // Check that http server was created and started
      expect(require('http').createServer).toHaveBeenCalled();
      
      // We can't directly check WebSocketService initialization in this test
// since we need to mock the http server differently
    }, 10000);
    
    test('should close the server', async () => {
      const config: ServerConfig = {
        enabled: true,
        port: 3000,
        host: 'localhost',
        development: false,
      };
      
      // Set a longer timeout for this test
      jest.setTimeout(10000);
      
      const { close } = await startServer(config);
      await close();
      
      expect(mockServer.close).toHaveBeenCalled();
    }, 10000);
    
    test('should handle server errors correctly', async () => {
      // Access the mock http module
      const http = require('http');
      
      // Store the original implementation
      const originalCreateServer = http.createServer;
      
      // Create a server error
      const serverError = new Error('Cannot create server');
      
      // Override the createServer implementation just for this test
      http.createServer.mockImplementationOnce(() => {
        throw serverError;
      });
      
      const config: ServerConfig = {
        enabled: true,
        port: 3000,
        host: 'localhost',
        development: false,
      };
      
      // Now when we call startServer, it should catch the error and throw a ServerError
      await expect(startServer(config)).rejects.toThrow('Failed to start server');
      
      // Restore the original implementation
      http.createServer = originalCreateServer;
    });
    
    test('should handle missing UI build files', async () => {
      // Mock fs.existsSync to simulate missing UI build
      const fs = require('fs');
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      const config: ServerConfig = {
        enabled: true,
        port: 3000,
        host: 'localhost',
        development: false,
      };
      
      const result = await startServer(config);
      expect(result).toEqual({
        close: expect.any(Function),
        url: 'http://localhost:3000',
      });
      
      // Check that the logger warning was called
      const { serverLogger } = require('../logger');
      expect(serverLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('UI build not found')
      );
      
      // Check that a fallback route was registered
      expect(express().get).toHaveBeenCalledWith('*', expect.any(Function));
    });
  });
});