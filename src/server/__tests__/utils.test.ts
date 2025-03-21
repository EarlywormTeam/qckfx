import { isPortAvailable, findAvailablePort } from '../utils';
import * as net from 'net';

// Create a typed mock server
interface MockServer {
  once: jest.Mock;
  listen: jest.Mock;
  close: jest.Mock;
}

// Mock net module
jest.mock('net', () => {
  // Setup mock server to properly store callbacks and allow tests to trigger them
  const mockListeningHandlers: Array<() => void> = [];
  const mockErrorHandlers: Array<() => void> = [];
  
  const mockServer = {
    once: jest.fn().mockImplementation((event: string, cb: () => void) => {
      if (event === 'listening') {
        mockListeningHandlers.push(cb);
      } else if (event === 'error') {
        mockErrorHandlers.push(cb);
      }
      return mockServer;
    }),
    listen: jest.fn().mockImplementation((port: number) => {
      // Return the server object to allow chaining
      return mockServer;
    }),
    close: jest.fn().mockImplementation((cb?: () => void) => {
      if (cb) setTimeout(cb, 0);
      return mockServer;
    }),
    // Helper methods for tests to trigger events
    triggerListening: () => {
      mockListeningHandlers.forEach(handler => setTimeout(handler, 0));
    },
    triggerError: () => {
      mockErrorHandlers.forEach(handler => setTimeout(handler, 0));
    },
  } as MockServer & { 
    triggerListening: () => void;
    triggerError: () => void;
  };
  
  const mockedNet = {
    createServer: jest.fn().mockReturnValue(mockServer),
  };
  return mockedNet;
});

describe('Server Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('isPortAvailable', () => {
    test('should return true if port is available', async () => {
      // Get the mock server from the mocked module
      const mockServer = (net.createServer() as unknown) as MockServer & { 
        triggerListening: () => void;
        triggerError: () => void;
      };
      
      // Create a promise for the isPortAvailable function
      const resultPromise = isPortAvailable(3000);
      
      // Simulate the server listening event
      mockServer.triggerListening();
      
      // Now wait for the result
      const result = await resultPromise;
      
      // Verify the result and that the mock was called correctly
      expect(result).toBe(true);
      expect(mockServer.once).toHaveBeenCalledWith('listening', expect.any(Function));
      expect(mockServer.listen).toHaveBeenCalledWith(3000);
    });
    
    test('should return false if port is not available', async () => {
      // Get the mock server from the mocked module
      const mockServer = (net.createServer() as unknown) as MockServer & { 
        triggerListening: () => void;
        triggerError: () => void;
      };
      
      // Create a promise for the isPortAvailable function
      const resultPromise = isPortAvailable(3000);
      
      // Simulate an error event
      mockServer.triggerError();
      
      // Now wait for the result
      const result = await resultPromise;
      
      // Verify the result and that the mock was called correctly
      expect(result).toBe(false);
      expect(mockServer.once).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });
  
  describe('findAvailablePort', () => {
    test('should return the start port if it is available', async () => {
      const mockServer = (net.createServer() as unknown) as MockServer & { 
        triggerListening: () => void;
        triggerError: () => void;
      };
      
      // Create a promise for the findAvailablePort function
      const resultPromise = findAvailablePort(3000);
      
      // Simulate the server listening event
      mockServer.triggerListening();
      
      // Now wait for the result
      const result = await resultPromise;
      expect(result).toBe(3000);
    });
    
    test('should find the next available port', async () => {
      const mockServer = (net.createServer() as unknown) as MockServer & { 
        triggerListening: () => void;
        triggerError: () => void;
      };
      
      // We'll need to handle multiple calls to createServer
      // Reset the implementation to handle the test scenario
      let portAttempt = 0;
      
      // Prepare the test by implementing a custom behavior of net.createServer
      (net.createServer as jest.Mock).mockImplementation(() => {
        portAttempt++;
        
        // This is a different mock server for each call to createServer
        const mockServerInstance = {
          once: jest.fn().mockImplementation((event: string, cb: () => void) => {
            // For the first two attempts, trigger error
            // For the third attempt, trigger listening
            if (portAttempt <= 2 && event === 'error') {
              setTimeout(cb, 0);
            } else if (portAttempt > 2 && event === 'listening') {
              setTimeout(cb, 0);
            }
            return mockServerInstance;
          }),
          listen: jest.fn().mockReturnThis(),
          close: jest.fn().mockImplementation((cb?: () => void) => {
            if (cb) setTimeout(cb, 0);
            return mockServerInstance;
          }),
        };
        
        return mockServerInstance;
      });
      
      const result = await findAvailablePort(3000);
      // In our test setup, we're expecting to get the first port that works which is port + portAttempt - 1
      // Since portAttempt is 3 when it succeeds, we expect 3000 + 2 = 3002
      expect(result).toBe(3002);
    });
    
    test('should throw an error if no port is available after 10 attempts', async () => {
      const mockServer = (net.createServer() as unknown) as MockServer & { 
        triggerListening: () => void;
        triggerError: () => void;
      };
      
      // We'll need to handle multiple calls to createServer
      // Reset the implementation to always trigger an error
      (net.createServer as jest.Mock).mockImplementation(() => {
        const mockServerInstance = {
          once: jest.fn().mockImplementation((event: string, cb: () => void) => {
            if (event === 'error') {
              setTimeout(cb, 0);
            }
            return mockServerInstance;
          }),
          listen: jest.fn().mockReturnThis(),
          close: jest.fn(),
        };
        
        return mockServerInstance;
      });
      
      await expect(findAvailablePort(3000)).rejects.toThrow('Could not find an available port');
    });
  });
});