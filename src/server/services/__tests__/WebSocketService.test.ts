import { createServer, Server as HTTPServer } from 'http';
import { AddressInfo } from 'net';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { WebSocketService, WebSocketEvent } from '../WebSocketService';
import { AgentServiceEvent, getAgentService } from '../AgentService';
import { sessionManager } from '../SessionManager';

// Mock the imports
jest.mock('../AgentService', () => {
  const EventEmitter = require('events');
  // Create a mock agent service class that extends EventEmitter
  const mockAgentService = new EventEmitter();
  
  mockAgentService.getPermissionRequests = jest.fn().mockReturnValue([]);
  mockAgentService.emit = jest.fn();
  
  return {
    AgentServiceEvent: {
      PROCESSING_STARTED: 'processing:started',
      PROCESSING_COMPLETED: 'processing:completed',
      PROCESSING_ERROR: 'processing:error',
      PROCESSING_ABORTED: 'processing:aborted',
      TOOL_EXECUTION: 'tool:execution',
      PERMISSION_REQUESTED: 'permission:requested',
      PERMISSION_RESOLVED: 'permission:resolved',
    },
    getAgentService: jest.fn().mockReturnValue(mockAgentService),
  };
});

jest.mock('../SessionManager', () => {
  const mockSession = {
    id: 'test-session-id',
    createdAt: new Date(),
    lastActiveAt: new Date(),
    state: { conversationHistory: [] },
    isProcessing: false,
  };
  
  return {
    sessionManager: {
      getSession: jest.fn(() => mockSession),
      updateSession: jest.fn(),
      createSession: jest.fn(() => mockSession),
    },
  };
});

describe('WebSocketService', () => {
  let httpServer: HTTPServer;
  let webSocketService: WebSocketService;
  let agentService: any;
  let clientSocket: ClientSocket;
  let port: number;

  beforeAll(() => {
    // Create HTTP server
    httpServer = createServer();
    httpServer.listen(() => {
      port = (httpServer.address() as AddressInfo).port;
    });

    // Initialize the WebSocketService
    webSocketService = WebSocketService.getInstance(httpServer);
    agentService = getAgentService();
  });

  afterAll(async () => {
    await webSocketService.close();
    httpServer.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be a singleton', () => {
    const instance1 = WebSocketService.getInstance();
    const instance2 = WebSocketService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should expose expected methods and properties', () => {
    expect(webSocketService.close).toBeDefined();
    expect(typeof webSocketService.close).toBe('function');
    expect(webSocketService.getPendingPermissions).toBeDefined();
    expect(typeof webSocketService.getPendingPermissions).toBe('function');
  });

  it('should call SessionManager when retrieving permissions', () => {
    webSocketService.getPendingPermissions('test-session-id');
    expect(agentService.getPermissionRequests).toHaveBeenCalledWith('test-session-id');
  });
});