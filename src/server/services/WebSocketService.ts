import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { AgentService, AgentServiceEvent, getAgentService } from './AgentService';
import { SessionManager, sessionManager } from './SessionManager';
import { serverLogger } from '../logger';

/**
 * Event types for WebSocket communication
 */
export enum WebSocketEvent {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  ERROR = 'error',
  JOIN_SESSION = 'join_session',
  LEAVE_SESSION = 'leave_session',
  PROCESSING_STARTED = 'processing_started',
  PROCESSING_COMPLETED = 'processing_completed',
  PROCESSING_ERROR = 'processing_error',
  PROCESSING_ABORTED = 'processing_aborted',
  TOOL_EXECUTION = 'tool_execution',
  PERMISSION_REQUESTED = 'permission_requested',
  PERMISSION_RESOLVED = 'permission_resolved',
  SESSION_UPDATED = 'session_updated',
}

/**
 * Singleton service to manage WebSocket connections and events
 */
export class WebSocketService {
  private static instance: WebSocketService;
  private io: SocketIOServer;
  private agentService: AgentService;
  private sessionManager: SessionManager;

  private constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: '*', // Consider restricting this in production
        methods: ['GET', 'POST'],
      },
    });

    this.agentService = getAgentService();
    this.sessionManager = sessionManager;

    this.setupSocketHandlers();
    this.setupAgentEventListeners();

    serverLogger.info('WebSocketService initialized');
  }

  /**
   * Get the singleton instance of WebSocketService
   */
  public static getInstance(server?: HTTPServer): WebSocketService {
    if (!WebSocketService.instance) {
      if (!server) {
        throw new Error('Server instance required for first WebSocketService initialization');
      }
      WebSocketService.instance = new WebSocketService(server);
    }
    return WebSocketService.instance;
  }
  
  /**
   * Get pending permission requests for a session
   */
  public getPendingPermissions(sessionId: string) {
    return this.agentService.getPermissionRequests(sessionId);
  }

  /**
   * Clean up and close all socket connections
   */
  public close(): Promise<void> {
    return new Promise((resolve) => {
      this.io.close(() => {
        serverLogger.info('WebSocketService closed');
        resolve();
      });
    });
  }

  /**
   * Setup socket connection handling
   */
  private setupSocketHandlers(): void {
    this.io.on(WebSocketEvent.CONNECT, (socket: Socket) => {
      serverLogger.debug(`Client connected: ${socket.id}`);

      // Handle join session requests
      socket.on(WebSocketEvent.JOIN_SESSION, (sessionId: string) => {
        if (!this.sessionManager.getSession(sessionId)) {
          socket.emit(WebSocketEvent.ERROR, {
            message: `Session ${sessionId} not found`,
          });
          return;
        }

        // Join the session's room
        socket.join(sessionId);
        serverLogger.debug(`Client ${socket.id} joined session ${sessionId}`);

        // Send current session state
        const session = this.sessionManager.getSession(sessionId);
        socket.emit(WebSocketEvent.SESSION_UPDATED, session);

        // If there are pending permission requests, send them
        const pendingPermissions = this.agentService.getPermissionRequests(sessionId);
        if (pendingPermissions.length > 0) {
          socket.emit(WebSocketEvent.PERMISSION_REQUESTED, {
            sessionId,
            permissions: pendingPermissions,
          });
        }
      });

      // Handle leave session requests
      socket.on(WebSocketEvent.LEAVE_SESSION, (sessionId: string) => {
        socket.leave(sessionId);
        serverLogger.debug(`Client ${socket.id} left session ${sessionId}`);
      });

      // Handle disconnects
      socket.on(WebSocketEvent.DISCONNECT, () => {
        serverLogger.debug(`Client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Setup listeners for AgentService events
   */
  private setupAgentEventListeners(): void {
    // Processing started
    this.agentService.on(AgentServiceEvent.PROCESSING_STARTED, ({ sessionId }) => {
      this.io.to(sessionId).emit(WebSocketEvent.PROCESSING_STARTED, { sessionId });
      
      // Also send updated session
      const session = this.sessionManager.getSession(sessionId);
      this.io.to(sessionId).emit(WebSocketEvent.SESSION_UPDATED, session);
    });

    // Processing completed
    this.agentService.on(AgentServiceEvent.PROCESSING_COMPLETED, ({ sessionId, result }) => {
      this.io.to(sessionId).emit(WebSocketEvent.PROCESSING_COMPLETED, { 
        sessionId,
        result,
      });
      
      // Also send updated session
      const session = this.sessionManager.getSession(sessionId);
      this.io.to(sessionId).emit(WebSocketEvent.SESSION_UPDATED, session);
    });

    // Processing error
    this.agentService.on(AgentServiceEvent.PROCESSING_ERROR, ({ sessionId, error }) => {
      this.io.to(sessionId).emit(WebSocketEvent.PROCESSING_ERROR, { 
        sessionId,
        error: {
          name: error.name,
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
      });
      
      // Also send updated session
      const session = this.sessionManager.getSession(sessionId);
      this.io.to(sessionId).emit(WebSocketEvent.SESSION_UPDATED, session);
    });

    // Processing aborted
    this.agentService.on(AgentServiceEvent.PROCESSING_ABORTED, ({ sessionId }) => {
      this.io.to(sessionId).emit(WebSocketEvent.PROCESSING_ABORTED, { sessionId });
      
      // Also send updated session
      const session = this.sessionManager.getSession(sessionId);
      this.io.to(sessionId).emit(WebSocketEvent.SESSION_UPDATED, session);
    });

    // Tool execution
    this.agentService.on(AgentServiceEvent.TOOL_EXECUTION, ({ sessionId, tool, result }) => {
      this.io.to(sessionId).emit(WebSocketEvent.TOOL_EXECUTION, { 
        sessionId,
        tool,
        result, 
      });
    });

    // Permission requested
    this.agentService.on(AgentServiceEvent.PERMISSION_REQUESTED, ({ sessionId, permission }) => {
      this.io.to(sessionId).emit(WebSocketEvent.PERMISSION_REQUESTED, { 
        sessionId,
        permission,
      });
    });

    // Permission resolved
    this.agentService.on(AgentServiceEvent.PERMISSION_RESOLVED, ({ sessionId, permissionId, resolution }) => {
      this.io.to(sessionId).emit(WebSocketEvent.PERMISSION_RESOLVED, { 
        sessionId,
        permissionId,
        resolution,
      });
    });
  }
}