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
  TOOL_EXECUTION_BATCH = 'tool_execution_batch',
  TOOL_EXECUTION_STARTED = 'tool_execution_started',
  TOOL_EXECUTION_COMPLETED = 'tool_execution_completed',
  TOOL_EXECUTION_ERROR = 'tool_execution_error',
  TOOL_EXECUTION_ABORTED = 'tool_execution_aborted',
  PERMISSION_REQUESTED = 'permission_requested',
  PERMISSION_RESOLVED = 'permission_resolved',
  PERMISSION_TIMEOUT = 'permission_timeout',
  SESSION_UPDATED = 'session_updated',
  STREAM_CONTENT = 'stream_content',
  FAST_EDIT_MODE_ENABLED = 'fast_edit_mode_enabled',
  FAST_EDIT_MODE_DISABLED = 'fast_edit_mode_disabled',
}

/**
 * Interface for tracking active tool execution
 */
interface ActiveToolExecution {
  startTime: Date;
  tool: {
    id: string;
    name: string;
  };
  paramSummary: string;
}

/**
 * Singleton service to manage WebSocket connections and events
 */
export class WebSocketService {
  private static instance: WebSocketService;
  private io: SocketIOServer;
  private agentService: AgentService;
  private sessionManager: SessionManager;
  
  // Map of sessionId -> Map of toolId -> active tool execution
  private activeTools: Map<string, Map<string, ActiveToolExecution>> = new Map();

  private constructor(server: HTTPServer) {
    // Set up debug mode before initializing socket.io
    if (process.env.NODE_ENV === 'development') {
      process.env.DEBUG = 'socket.io:*,engine.io:*';
    }
    
    serverLogger.info('Initializing Socket.IO server with debug enabled...');
    
    // Socket.IO configuration with fallback to polling
    this.io = new SocketIOServer(server);
    
    // Add detailed error logging
    this.io.engine.on("connection_error", (err) => {
      serverLogger.error("Socket.IO connection error:", {
        code: err.code,
        message: err.message,
        context: err.context,
        headers: err.req?.headers
      });
    });
    
    serverLogger.info('Socket.IO server instance created, configuration:', {
      cors: true,
      engine: this.io.engine ? 'Started' : 'Not started',
      httpServer: server ? 'Connected' : 'Missing'
    });
    
    // Log Socket.IO connections in development
    if (process.env.NODE_ENV === 'development') {
      serverLogger.debug('Setting up verbose Socket.IO logging for development');
    }

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
   * Get active tools for a session
   */
  public getActiveTools(sessionId: string): Array<{
    toolId: string;
    name: string;
    startTime: Date;
    paramSummary: string;
    elapsedTimeMs: number;
  }> {
    const sessionTools = this.activeTools.get(sessionId);
    if (!sessionTools) {
      return [];
    }
    
    const now = new Date();
    return Array.from(sessionTools.entries()).map(([toolId, data]) => ({
      toolId,
      name: data.tool.name,
      startTime: data.startTime,
      paramSummary: data.paramSummary,
      elapsedTimeMs: now.getTime() - data.startTime.getTime(),
    }));
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
    // Log all Engine.io events for debugging
    if (this.io.engine) {
      this.io.engine.on('connection', (socket) => {
        serverLogger.info(`Socket.IO Engine - new raw connection: ${socket.id}`);
        
        // Monitor socket transport
        socket.on('transport', (transport: { name: string }) => {
          serverLogger.info(`Socket ${socket.id} transport: ${transport.name}`);
        });
        
        // Monitor upgrade attempts
        socket.on('upgrading', (transport: { name: string }) => {
          serverLogger.info(`Socket ${socket.id} upgrading to ${transport.name}`);
        });
        
        // Monitor upgrade completions
        socket.on('upgrade', (transport: { name: string }) => {
          serverLogger.info(`Socket ${socket.id} upgraded to ${transport.name}`);
        });
        
        // Monitor closing
        socket.on('close', (reason: string) => {
          serverLogger.info(`Socket.IO Engine - connection ${socket.id} closed, reason: ${reason}`);
        });
        
        // Monitor errors
        socket.on('error', (err: Error) => {
          serverLogger.error(`Socket.IO Engine - connection ${socket.id} error:`, err);
        });
      });
      
      // Monitor new incoming connections at the engine level
      this.io.engine.on('initial_headers', (headers, req) => {
        serverLogger.debug('Socket.IO initial_headers event:', { 
          url: req.url,
          method: req.method,
          headers: JSON.stringify(req.headers)
        });
      });
    } else {
      serverLogger.error('Socket.IO engine not available for monitoring!');
    }
    
    // Handle Socket.IO connections
    this.io.on(WebSocketEvent.CONNECT, (socket: Socket) => {
      serverLogger.info(`Client connected: ${socket.id} (transport: ${socket.conn.transport.name})`);
      
      // Immediately send a welcome message to confirm the connection
      socket.emit('welcome', { message: 'Connected to QCKFX WebSocket server', socketId: socket.id });
      
      // Handle connection errors
      socket.conn.on('error', (err) => {
        serverLogger.error(`Socket ${socket.id} connection error:`, err);
      });
      
      // Log all incoming events in development
      if (process.env.NODE_ENV === 'development') {
        // Instead of replacing socket.on, we'll add a listener for all events
        serverLogger.debug(`Added verbose logging for socket ${socket.id}`);
        // Listen for any event (we can't replace socket.on due to TypeScript type constraints)
        socket.onAny((event, ...args) => {
          serverLogger.debug(`Socket ${socket.id} received event '${event}' with data:`, args);
        });
      }

      // Handle join session requests
      socket.on(WebSocketEvent.JOIN_SESSION, (sessionId: string) => {
        serverLogger.debug(`Join session request: ${sessionId} from client ${socket.id}`);
        
        try {
          if (!this.sessionManager.getSession(sessionId)) {
            serverLogger.warn(`Session ${sessionId} not found for client ${socket.id}`);
            socket.emit(WebSocketEvent.ERROR, {
              message: `Session ${sessionId} not found`,
            });
            return;
          }

          // Join the session's room
          socket.join(sessionId);
          serverLogger.info(`Client ${socket.id} joined session ${sessionId}`);

          // Send current session state
          const session = this.sessionManager.getSession(sessionId);
          socket.emit(WebSocketEvent.SESSION_UPDATED, session);
          serverLogger.debug(`Sent updated session to client ${socket.id}`);

          // If there are pending permission requests, send them
          const pendingPermissions = this.agentService.getPermissionRequests(sessionId);
          if (pendingPermissions.length > 0) {
            serverLogger.debug(`Sending ${pendingPermissions.length} pending permissions to client ${socket.id}`);
            socket.emit(WebSocketEvent.PERMISSION_REQUESTED, {
              sessionId,
              permissions: pendingPermissions,
            });
          }
          
          // Send active tool executions, if any
          const activeTools = this.getActiveTools(sessionId);
          if (activeTools.length > 0) {
            serverLogger.debug(`Sending ${activeTools.length} active tool executions to client ${socket.id}`);
            // Send each active tool as a separate TOOL_EXECUTION_STARTED event
            activeTools.forEach(tool => {
              socket.emit(WebSocketEvent.TOOL_EXECUTION_STARTED, {
                sessionId,
                tool: {
                  id: tool.toolId,
                  name: tool.name,
                },
                paramSummary: tool.paramSummary,
                timestamp: tool.startTime.toISOString(),
                isActive: true,
                elapsedTimeMs: tool.elapsedTimeMs,
              });
            });
          }
        } catch (error) {
          serverLogger.error(`Error in JOIN_SESSION handler:`, error);
          socket.emit(WebSocketEvent.ERROR, {
            message: `Error joining session: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      });

      // Handle leave session requests
      socket.on(WebSocketEvent.LEAVE_SESSION, (sessionId: string) => {
        try {
          socket.leave(sessionId);
          serverLogger.debug(`Client ${socket.id} left session ${sessionId}`);
        } catch (error) {
          serverLogger.error(`Error in LEAVE_SESSION handler:`, error);
        }
      });

      // Add a ping handler for keepalive
      socket.on('ping', (callback) => {
        if (typeof callback === 'function') {
          callback({ time: Date.now() });
        }
      });

      // Handle disconnects
      socket.on(WebSocketEvent.DISCONNECT, (reason) => {
        serverLogger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
        
        // Cleanup logic for transport close - this helps prevent lingering socket connections
        if (reason === 'transport close' || reason === 'transport error') {
          serverLogger.warn(`Transport-level disconnection for ${socket.id}, cleaning up resources`);
          
          // Ensure socket is removed from all rooms
          Object.keys(socket.rooms).forEach(room => {
            if (room !== socket.id) {
              socket.leave(room);
              serverLogger.debug(`Forced leave room ${room} for disconnected socket ${socket.id}`);
            }
          });
          
          // Force socket cleanup (disconnect will have already happened, but this handles edge cases)
          if (socket.connected) {
            serverLogger.warn(`Forcing disconnect for socket ${socket.id} that reports connected after transport close`);
            try {
              socket.disconnect(true);
            } catch (err) {
              serverLogger.error(`Error during forced disconnect: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }
      });
      
      // Add special handling for transport errors at the connection level
      socket.conn.on('packet', (packet: { type: string; data?: unknown }) => {
        if (packet.type === 'error') {
          serverLogger.error(`Transport packet error for socket ${socket.id}:`, packet.data);
        }
      });
    });
  }

  /**
   * Setup listeners for AgentService events
   */
  private setupAgentEventListeners(): void {
    // Processing started - only send the processing event
    this.agentService.on(AgentServiceEvent.PROCESSING_STARTED, ({ sessionId }) => {
      this.io.to(sessionId).emit(WebSocketEvent.PROCESSING_STARTED, { sessionId });
      // No need to send session update here since it doesn't contain new information yet
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
      // No need to send session update on error as there's no new conversation data
    });

    // Processing aborted
    this.agentService.on(AgentServiceEvent.PROCESSING_ABORTED, ({ sessionId }) => {
      this.io.to(sessionId).emit(WebSocketEvent.PROCESSING_ABORTED, { sessionId });
      // No need to send session update on abort as there's no new conversation data
    });

    // Legacy tool execution (for backward compatibility)
    this.agentService.on(AgentServiceEvent.TOOL_EXECUTION, ({ sessionId, tool, result }) => {
      this.io.to(sessionId).emit(WebSocketEvent.TOOL_EXECUTION, { 
        sessionId,
        tool,
        result, 
      });
    });
    
    // Tool execution started
    this.agentService.on(AgentServiceEvent.TOOL_EXECUTION_STARTED, ({ sessionId, tool, args, paramSummary, timestamp }) => {
      // Track active tool execution
      if (!this.activeTools.has(sessionId)) {
        this.activeTools.set(sessionId, new Map());
      }
      
      this.activeTools.get(sessionId)!.set(tool.id, {
        startTime: new Date(timestamp),
        tool,
        paramSummary
      });
      
      // Forward the event to clients
      this.io.to(sessionId).emit(WebSocketEvent.TOOL_EXECUTION_STARTED, { 
        sessionId,
        tool,
        args,
        paramSummary,
        timestamp,
        isActive: true,
      });
      
      serverLogger.debug(`Tool execution started: ${tool.name} (${tool.id}) in session ${sessionId}`);
    });
    
    // Tool execution completed
    this.agentService.on(AgentServiceEvent.TOOL_EXECUTION_COMPLETED, ({ sessionId, tool, result, paramSummary, executionTime, timestamp }) => {
      // Remove from active tools
      const activeToolData = this.activeTools.get(sessionId)?.get(tool.id);
      this.activeTools.get(sessionId)?.delete(tool.id);
      
      // Clean up empty maps
      if (this.activeTools.get(sessionId)?.size === 0) {
        this.activeTools.delete(sessionId);
      }
      
      // Forward the event to clients
      this.io.to(sessionId).emit(WebSocketEvent.TOOL_EXECUTION_COMPLETED, { 
        sessionId,
        tool,
        result,
        paramSummary,
        executionTime,
        timestamp,
        isActive: false,
        startTime: activeToolData?.startTime.toISOString(),
      });
      
      serverLogger.debug(`Tool execution completed: ${tool.name} (${tool.id}) in session ${sessionId}, took ${executionTime}ms`);
    });
    
    // Tool execution error
    this.agentService.on(AgentServiceEvent.TOOL_EXECUTION_ERROR, ({ sessionId, tool, error, paramSummary, timestamp }) => {
      // Remove from active tools
      const activeToolData = this.activeTools.get(sessionId)?.get(tool.id);
      this.activeTools.get(sessionId)?.delete(tool.id);
      
      // Clean up empty maps
      if (this.activeTools.get(sessionId)?.size === 0) {
        this.activeTools.delete(sessionId);
      }
      
      // Forward the event to clients
      this.io.to(sessionId).emit(WebSocketEvent.TOOL_EXECUTION_ERROR, { 
        sessionId,
        tool,
        error,
        paramSummary,
        timestamp,
        isActive: false,
        startTime: activeToolData?.startTime.toISOString(),
      });
      
      serverLogger.debug(`Tool execution error: ${tool.name} (${tool.id}) in session ${sessionId}, error: ${error.message}`);
    });
    
    // Tool execution aborted
    this.agentService.on(AgentServiceEvent.TOOL_EXECUTION_ABORTED, ({ sessionId, tool, timestamp, abortTimestamp }) => {
      // Remove from active tools
      const activeToolData = this.activeTools.get(sessionId)?.get(tool.id);
      this.activeTools.get(sessionId)?.delete(tool.id);
      
      // Clean up empty maps
      if (this.activeTools.get(sessionId)?.size === 0) {
        this.activeTools.delete(sessionId);
      }
      
      // Forward the event to clients
      this.io.to(sessionId).emit(WebSocketEvent.TOOL_EXECUTION_ABORTED, { 
        sessionId,
        tool,
        timestamp,
        abortTimestamp,
        isActive: false,
        startTime: activeToolData?.startTime.toISOString(),
      });
      
      serverLogger.debug(`Tool execution aborted: ${tool.name} (${tool.id}) in session ${sessionId}`);
    });

    // Permission requested
    this.agentService.on(AgentServiceEvent.PERMISSION_REQUESTED, ({ permissionId, sessionId, toolId, toolName, args, timestamp }) => {
      // Format the permission object according to the expected UI format
      this.io.to(sessionId).emit(WebSocketEvent.PERMISSION_REQUESTED, { 
        sessionId,
        permission: {
          id: permissionId,
          toolId: toolId,
          toolName: toolName || toolId, // Fallback to toolId if name isn't available
          args: args,
          timestamp: timestamp
        },
      });
      
      serverLogger.debug(`Permission request sent to clients: ${permissionId} for tool ${toolId}`);
    });

    // Permission resolved
    this.agentService.on(AgentServiceEvent.PERMISSION_RESOLVED, ({ sessionId, permissionId, granted }) => {
      // Map AgentService's "granted" property to WebSocketEvent's "resolution" property
      this.io.to(sessionId).emit(WebSocketEvent.PERMISSION_RESOLVED, { 
        sessionId,
        permissionId,
        resolution: granted, // Map "granted" to "resolution" to match the WebSocketEvent type
      });
    });
    
    // Fast Edit Mode enabled
    this.agentService.on(AgentServiceEvent.FAST_EDIT_MODE_ENABLED, ({ sessionId }) => {
      this.io.to(sessionId).emit(WebSocketEvent.FAST_EDIT_MODE_ENABLED, { 
        sessionId,
        enabled: true,
      });
      
      serverLogger.debug(`Fast Edit Mode enabled for session ${sessionId}`);
    });
    
    // Fast Edit Mode disabled
    this.agentService.on(AgentServiceEvent.FAST_EDIT_MODE_DISABLED, ({ sessionId }) => {
      this.io.to(sessionId).emit(WebSocketEvent.FAST_EDIT_MODE_DISABLED, { 
        sessionId,
        enabled: false,
      });
      
      serverLogger.debug(`Fast Edit Mode disabled for session ${sessionId}`);
    });
    
    // No permission timeout handler - permission requests wait indefinitely
  }
}