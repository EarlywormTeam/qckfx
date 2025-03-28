import { vi } from 'vitest';
import { Socket } from 'socket.io-client';

// Define callback types
type SocketCallback = (...args: unknown[]) => void;

// Create a registry to store callbacks
export const __mockCallbacks: Record<string, SocketCallback[]> = {};
export const __mockIoCallbacks: Record<string, SocketCallback[]> = {};

// Create a mockSocket object with explicit typing
export const mockSocket: Partial<Socket> = {
  on: vi.fn().mockImplementation((event: string | symbol, callback: SocketCallback): Socket => {
    const eventKey = String(event);
    __mockCallbacks[eventKey] = __mockCallbacks[eventKey] || [];
    __mockCallbacks[eventKey].push(callback);
    return mockSocket as Socket;
  }),
  
  off: vi.fn().mockImplementation((event?: string | symbol, callback?: SocketCallback): Socket => {
    if (event) {
      const eventKey = String(event);
      if (__mockCallbacks[eventKey] && callback) {
        __mockCallbacks[eventKey] = __mockCallbacks[eventKey].filter(cb => cb !== callback);
      } else if (__mockCallbacks[eventKey]) {
        delete __mockCallbacks[eventKey];
      }
    }
    return mockSocket as Socket;
  }),
  
  emit: vi.fn(),
  disconnect: vi.fn(),
  connect: vi.fn(),
  
  io: {
    on: vi.fn().mockImplementation((event: string, callback: SocketCallback) => {
      __mockIoCallbacks[event] = __mockIoCallbacks[event] || [];
      __mockIoCallbacks[event].push(callback);
      return mockSocket.io;
    }),
    
    off: vi.fn().mockImplementation((event?: string, callback?: SocketCallback) => {
      if (event) {
        if (__mockIoCallbacks[event] && callback) {
          __mockIoCallbacks[event] = __mockIoCallbacks[event].filter(cb => cb !== callback);
        } else if (__mockIoCallbacks[event]) {
          delete __mockIoCallbacks[event];
        }
      }
      return mockSocket.io;
    }),
    
    // Minimal Manager implementation to satisfy TypeScript
    engine: {},
    _autoConnect: true,
    _readyState: 'open',
    _reconnecting: false,
    uri: '',
    opts: {},
    nsps: {},
    subs: [],
    backoff: {
      ms: 1000,
      max: 5000
    },
    _reconnection: true,
    _reconnectionAttempts: Infinity,
    _reconnectionDelay: 1000,
    _reconnectionDelayMax: 5000,
    _randomizationFactor: 0.5,
    _timeout: 20000,
    // Additional required Manager properties
    encode: vi.fn(),
    decode: vi.fn(),
    autoConnect: true,
    path: '/socket.io',
    hostname: 'localhost',
    secure: false,
    port: '3000',
    query: {},
    timestampRequests: false,
    timestampParam: 't',
    supportsBinary: true,
    upgrade: true,
    forceJSONP: false,
    forceBase64: false,
    enablesXDR: false,
    withCredentials: false,
    randomizationFactor: 0.5,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    transports: ['polling', 'websocket'],
    transportOptions: {},
    readyState: 'open',
    connecting: [],
    connected: false,
    disconnected: true,
    emitAll: vi.fn(),
    updateSocketIds: vi.fn(),
    reconnect: vi.fn(),
    destroy: vi.fn(),
    packet: vi.fn(),
    processPacketQueue: vi.fn(),
    cleanup: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
    onclose: vi.fn(),
    onping: vi.fn(),
    ondata: vi.fn(),
    onerror: vi.fn(),
    ondecoded: vi.fn(),
    open: vi.fn(),
    onopen: vi.fn(),
    onreconnect: vi.fn()
  } as unknown as Socket['io']
};

// Export the io function with proper return type
export const io = vi.fn((): Socket => mockSocket as Socket);

// Helper functions to trigger events
export const __triggerEvent = (event: string, ...args: unknown[]): void => {
  if (__mockCallbacks[event]) {
    __mockCallbacks[event].forEach(callback => callback(...args));
  }
};

export const __triggerIoEvent = (event: string, ...args: unknown[]): void => {
  if (__mockIoCallbacks[event]) {
    __mockIoCallbacks[event].forEach(callback => callback(...args));
  }
};

// Clear all mocked callbacks
export const __clearMockCallbacks = () => {
  Object.keys(__mockCallbacks).forEach(key => {
    delete __mockCallbacks[key];
  });
  Object.keys(__mockIoCallbacks).forEach(key => {
    delete __mockIoCallbacks[key];
  });
};

// Export default for ESM
export default { io };