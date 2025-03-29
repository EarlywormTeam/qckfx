/**
 * Real WebSocket service implementation that connects to the server
 */
import { EventEmitter } from 'events';
import { io, Socket } from 'socket.io-client';
import { IWebSocketService } from '../interfaces/IWebSocketService';
import { 
  WebSocketEvent, 
  WebSocketEventMap,
  ConnectionStatus
} from '@/types/api';
import { 
  SOCKET_URL
} from '@/config/api';
import { throttle } from '@/utils/performance';

export class RealWebSocketService extends EventEmitter implements IWebSocketService {
  private socket: Socket | null = null;
  private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private reconnectAttempts = 0;
  private currentSessionId: string | null = null;
  private messageBuffer: Map<string, unknown[]> = new Map();
  private flushIntervalTimer: NodeJS.Timeout | null = null;
  
  // Message buffer for tool execution results
  private toolResultBuffer: Record<string, unknown[]> = {};
  // Last time tool results were flushed
  private lastToolFlush: Record<string, number> = {};
  // Max buffer size before forcing a flush
  private readonly maxBufferSize = 50;
  // Auto-flush interval in ms
  private readonly flushIntervalMs = 500;
  // Throttle event emission for frequently updated tools
  private readonly throttleInterval = 100;
  
  // Abort handling
  private abortTimestamps: Map<string, number> = new Map();
  private activeToolsMap: Map<string, Array<{ id: string; name: string; state: string }>> = new Map();
  private isProcessingMap: Map<string, boolean> = new Map();

  // Throttled event emitter for high-frequency events
  private throttledEmit = throttle<(event: string, data: unknown) => void>(
    (event: string, data: unknown) => {
      super.emit(event, data);
    },
    this.throttleInterval
  );

  constructor() {
    super();
    this.initializeSocket();
  }
  
  /**
   * Override the emit method to handle buffering
   */
  public emit(event: string, ...args: unknown[]): boolean {
    // For tool execution events, use buffering
    if (event === WebSocketEvent.TOOL_EXECUTION) {
      const data = args[0] as Record<string, unknown>;
      let toolId: string | undefined;
      
      if (typeof data.tool === 'object' && data.tool !== null && 'id' in data.tool) {
        toolId = data.tool.id as string;
      }
      
      if (toolId) {
        this.bufferToolResult(toolId, data);
        return true;
      }
    }
    
    // Use throttled emit for high-frequency events
    if (
      event === WebSocketEvent.PROCESSING_STARTED ||
      event === WebSocketEvent.SESSION_UPDATED
    ) {
      this.throttledEmit(event, args[0]);
      return true;
    }
    
    // Default behavior for other events
    return super.emit(event, ...args);
  }

  /**
   * Initialize the Socket.io connection
   */
  private initializeSocket(): void {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.updateConnectionStatus(ConnectionStatus.CONNECTING);

    // Create a stable socket.io connection that prioritizes WebSocket
    console.log('Creating socket.io connection with WebSocket priority');
    
    // Get the current URL (or use config)
    const url = SOCKET_URL || window.location.origin;
    
    console.log('Socket.IO connecting to:', url);
    
    // Simplified Socket.IO configuration with fallback to polling
    this.socket = io();
    
    console.log('Socket.IO instance created with fallback transports');
    
    // Add detailed error logging
    this.socket.on("connect_error", (err: Error) => {
      console.error("Connection error:", err.message);
    });
    
    this.socket.on("disconnect", (reason: string) => {
      console.error("Disconnect:", reason);
    });
    
    // Log socket events in development using standard methods
    if (process.env.NODE_ENV === 'development') {
      // Listen for all events to log them
      this.socket.onAny((event, ...args) => {
        console.log('Socket.IO RECEIVED:', event, args);
      });
      
      // Create a wrapper for emit to log outgoing events
      const origEmit = this.socket.emit.bind(this.socket);
      this.socket.emit = (event: string, ...args: unknown[]) => {
        console.log('Socket.IO SENDING:', [event, ...args]);
        return origEmit(event, ...args);
      };
    }

    console.log('WebSocket initializing connection to server...');
    
    // Enhanced initialization - retry connection if initial attempt fails
    this.setupInitialConnectionRetry();
    this.setupSocketEventHandlers();
    this.startBufferFlushInterval();
  }
  
  /**
   * Set up retry mechanism for initial connection
   * This helps during development when the server might not be ready immediately
   */
  private setupInitialConnectionRetry(): void {
    // If not connected after 3 seconds, try forcing a reconnection
    setTimeout(() => {
      if (this.socket && this.connectionStatus !== ConnectionStatus.CONNECTED) {
        console.log('WebSocket initial connection timeout - attempting reconnection...');
        this.reconnect(); // Force reconnection
      }
    }, 3000);
  }

  /**
   * Set up handlers for socket events
   */
  private setupSocketEventHandlers(): void {
    if (!this.socket) return;

    // Connection established
    this.socket.on(WebSocketEvent.CONNECT, () => {
      console.log('WebSocket connected');
      this.updateConnectionStatus(ConnectionStatus.CONNECTED);
      this.reconnectAttempts = 0;
      
      // Rejoin the session if there was one active
      if (this.currentSessionId) {
        this.joinSession(this.currentSessionId);
      }
      
      this.emit('connection', { status: ConnectionStatus.CONNECTED });
    });

    // Connection error
    this.socket.on(WebSocketEvent.ERROR, (error: Error | Record<string, unknown> | string) => {
      console.error('WebSocket error:', error);
      this.updateConnectionStatus(ConnectionStatus.ERROR);
      
      // Extract error message safely
      let errorMessage = 'Unknown socket error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      this.emit('connection', { 
        status: ConnectionStatus.ERROR, 
        error: errorMessage
      });
    });

    // Disconnection
    this.socket.on(WebSocketEvent.DISCONNECT, (reason: string) => {
      console.log('WebSocket disconnected:', reason);
      this.updateConnectionStatus(ConnectionStatus.DISCONNECTED);
      this.emit('connection', { 
        status: ConnectionStatus.DISCONNECTED, 
        reason 
      });
    });

    // Reconnection attempt
    this.socket.io.on('reconnect_attempt', (attempt: number) => {
      console.log(`WebSocket reconnection attempt ${attempt}`);
      this.reconnectAttempts = attempt;
      this.updateConnectionStatus(ConnectionStatus.RECONNECTING);
      this.emit('connection', { 
        status: ConnectionStatus.RECONNECTING, 
        attempt 
      });
    });

    // Agent events
    this.socket.on(WebSocketEvent.PROCESSING_STARTED, (data: WebSocketEventMap[WebSocketEvent.PROCESSING_STARTED]) => {
      this.bufferEvent(WebSocketEvent.PROCESSING_STARTED, data);
      this.emit(WebSocketEvent.PROCESSING_STARTED, data);
    });

    this.socket.on(WebSocketEvent.PROCESSING_COMPLETED, (data: WebSocketEventMap[WebSocketEvent.PROCESSING_COMPLETED]) => {
      this.bufferEvent(WebSocketEvent.PROCESSING_COMPLETED, data);
      this.emit(WebSocketEvent.PROCESSING_COMPLETED, data);
    });

    this.socket.on(WebSocketEvent.PROCESSING_ERROR, (data: WebSocketEventMap[WebSocketEvent.PROCESSING_ERROR]) => {
      this.bufferEvent(WebSocketEvent.PROCESSING_ERROR, data);
      this.emit(WebSocketEvent.PROCESSING_ERROR, data);
    });

    this.socket.on(WebSocketEvent.PROCESSING_ABORTED, (data: WebSocketEventMap[WebSocketEvent.PROCESSING_ABORTED]) => {
      // Store the abort timestamp for this session
      const abortTimestamp = Date.now();
      this.abortTimestamps.set(data.sessionId, abortTimestamp);
      
      // Mark the session as not processing
      this.isProcessingMap?.set(data.sessionId, false);
      
      // Track aborted tools - find all active tools for this session
      const abortedTools = new Set<string>();
      
      // If we have active tools tracking, check for tools to abort
      if (this.activeToolsMap.has(data.sessionId)) {
        const activeTools = this.activeToolsMap.get(data.sessionId) || [];
        
        // For each active tool, emit a completion event with aborted state
        activeTools.forEach(tool => {
          // Add to aborted tools set
          abortedTools.add(tool.id);
          
          // Change the state to aborted
          tool.state = 'aborted';
          
          // Create an abort result
          const abortResult = {
            aborted: true,
            abortTimestamp
          };
          
          // Emit an aborted event instead of a completion event
          this.emit(WebSocketEvent.TOOL_EXECUTION_ABORTED, {
            sessionId: data.sessionId,
            tool: {
              id: tool.id,
              name: tool.name || 'Tool',
            },
            timestamp: new Date().toISOString(),
            abortTimestamp,
            isActive: false,
            startTime: new Date(abortTimestamp - 1000).toISOString(), // Approximate
          });
        });
        
        // Clear active tools for this session
        this.activeToolsMap.set(data.sessionId, []);
      }
      
      // No need to store aborted tools in session storage anymore
      // Each tool will have its own status
      
      // Add abort data to the event
      const enrichedData = {
        ...data,
        abortTimestamp,
        abortedTools: [...abortedTools]
      };
      
      // Buffer and emit the event
      this.bufferEvent(WebSocketEvent.PROCESSING_ABORTED, enrichedData);
      this.emit(WebSocketEvent.PROCESSING_ABORTED, enrichedData);
    });

    this.socket.on(WebSocketEvent.TOOL_EXECUTION, (data: WebSocketEventMap[WebSocketEvent.TOOL_EXECUTION]) => {
      this.bufferEvent(WebSocketEvent.TOOL_EXECUTION, data);
      this.emit(WebSocketEvent.TOOL_EXECUTION, data);
    });

    this.socket.on(WebSocketEvent.PERMISSION_REQUESTED, (data: WebSocketEventMap[WebSocketEvent.PERMISSION_REQUESTED]) => {
      this.bufferEvent(WebSocketEvent.PERMISSION_REQUESTED, data);
      this.emit(WebSocketEvent.PERMISSION_REQUESTED, data);
    });

    this.socket.on(WebSocketEvent.PERMISSION_RESOLVED, (data: WebSocketEventMap[WebSocketEvent.PERMISSION_RESOLVED]) => {
      this.bufferEvent(WebSocketEvent.PERMISSION_RESOLVED, data);
      this.emit(WebSocketEvent.PERMISSION_RESOLVED, data);
    });

    this.socket.on(WebSocketEvent.SESSION_UPDATED, (data: WebSocketEventMap[WebSocketEvent.SESSION_UPDATED]) => {
      this.bufferEvent(WebSocketEvent.SESSION_UPDATED, data);
      this.emit(WebSocketEvent.SESSION_UPDATED, data);
    });
    
    // Handle tool execution started to track active tools
    this.socket.on(WebSocketEvent.TOOL_EXECUTION_STARTED, (data: WebSocketEventMap[WebSocketEvent.TOOL_EXECUTION_STARTED]) => {
      // Track this tool as active for the session
      if (!this.activeToolsMap.has(data.sessionId)) {
        this.activeToolsMap.set(data.sessionId, []);
      }
      
      const activeTools = this.activeToolsMap.get(data.sessionId) || [];
      activeTools.push({
        id: data.tool.id,
        name: data.tool.name,
        state: 'running'
      });
      
      this.activeToolsMap.set(data.sessionId, activeTools);
      
      // Buffer and emit the event
      this.bufferEvent(WebSocketEvent.TOOL_EXECUTION_STARTED, data);
      this.emit(WebSocketEvent.TOOL_EXECUTION_STARTED, data);
    });
    
    // Handle tool execution completed to remove from active tools
    this.socket.on(WebSocketEvent.TOOL_EXECUTION_COMPLETED, (data: WebSocketEventMap[WebSocketEvent.TOOL_EXECUTION_COMPLETED]) => {
      // Check if the session was aborted
      const abortTimestamp = this.abortTimestamps.get(data.sessionId);
      const eventTimestamp = data.timestamp ? new Date(data.timestamp).getTime() : Date.now();
      
      // If this event happened after abort, ignore it
      if (abortTimestamp && eventTimestamp > abortTimestamp) {
        console.log('Ignoring tool completion event after abort:', data.tool.id);
        return;
      }
      
      // Remove from active tools
      if (this.activeToolsMap.has(data.sessionId)) {
        const activeTools = this.activeToolsMap.get(data.sessionId) || [];
        const updatedTools = activeTools.filter(tool => tool.id !== data.tool.id);
        this.activeToolsMap.set(data.sessionId, updatedTools);
      }
      
      // Buffer and emit the event
      this.bufferEvent(WebSocketEvent.TOOL_EXECUTION_COMPLETED, data);
      this.emit(WebSocketEvent.TOOL_EXECUTION_COMPLETED, data);
    });
    
    // Handle tool execution error to remove from active tools
    this.socket.on(WebSocketEvent.TOOL_EXECUTION_ERROR, (data: WebSocketEventMap[WebSocketEvent.TOOL_EXECUTION_ERROR]) => {
      // Check if the session was aborted
      const abortTimestamp = this.abortTimestamps.get(data.sessionId);
      const eventTimestamp = data.timestamp ? new Date(data.timestamp).getTime() : Date.now();
      
      // If this event happened after abort, ignore it
      if (abortTimestamp && eventTimestamp > abortTimestamp) {
        console.log('Ignoring tool error event after abort:', data.tool.id);
        return;
      }
      
      // Remove from active tools
      if (this.activeToolsMap.has(data.sessionId)) {
        const activeTools = this.activeToolsMap.get(data.sessionId) || [];
        const updatedTools = activeTools.filter(tool => tool.id !== data.tool.id);
        this.activeToolsMap.set(data.sessionId, updatedTools);
      }
      
      // Buffer and emit the event
      this.bufferEvent(WebSocketEvent.TOOL_EXECUTION_ERROR, data);
      this.emit(WebSocketEvent.TOOL_EXECUTION_ERROR, data);
    });
  }

  /**
   * Join a session to receive events for that session
   */
  public joinSession(sessionId: string): void {
    if (!this.socket || !this.isConnected()) {
      console.warn('Cannot join session: socket not connected');
      this.currentSessionId = sessionId; // Store for reconnection
      return;
    }

    // If we're already in a session, leave it first
    if (this.currentSessionId && this.currentSessionId !== sessionId) {
      this.leaveSession(this.currentSessionId);
    }

    this.socket.emit(WebSocketEvent.JOIN_SESSION, sessionId);
    this.currentSessionId = sessionId;
    console.log(`Joined session ${sessionId}`);
  }

  /**
   * Leave a session to stop receiving events for that session
   */
  public leaveSession(sessionId: string): void {
    if (!this.socket || !this.isConnected()) {
      console.warn('Cannot leave session: socket not connected');
      return;
    }

    this.socket.emit(WebSocketEvent.LEAVE_SESSION, sessionId);
    
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null;
    }
    
    console.log(`Left session ${sessionId}`);
  }

  /**
   * Connect to the WebSocket server
   */
  public connect(): void {
    this.initializeSocket();
  }

  /**
   * Check if the socket is currently connected
   */
  public isConnected(): boolean {
    return this.connectionStatus === ConnectionStatus.CONNECTED;
  }

  /**
   * Get the current connection status
   */
  public getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Get the current session ID
   */
  public getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Add an event to the buffer for batch processing
   */
  private bufferEvent(event: string, data: unknown): void {
    if (!this.messageBuffer.has(event)) {
      this.messageBuffer.set(event, []);
    }
    
    const buffer = this.messageBuffer.get(event);
    if (buffer) {
      buffer.push({
        timestamp: Date.now(),
        data
      });
    }
  }

  /**
   * Start interval for flushing buffered events
   */
  private startBufferFlushInterval(): void {
    if (this.flushIntervalTimer) {
      clearInterval(this.flushIntervalTimer);
    }
    
    this.flushIntervalTimer = setInterval(() => {
      this.flushBuffers();
    }, 100); // Flush every 100ms
  }

  /**
   * Flush all buffered events
   */
  private flushBuffers(): void {
    this.messageBuffer.forEach((messages, event) => {
      if (messages.length > 0) {
        this.emit(`${event}:batch`, messages);
        this.messageBuffer.set(event, []);
      }
    });
    
    // Also flush tool buffers
    this.flushAllToolBuffers();
  }
  
  /**
   * Buffer tool results and flush when appropriate
   */
  private bufferToolResult(toolId: string, data: unknown): void {
    // Initialize buffer if needed
    if (!this.toolResultBuffer[toolId]) {
      this.toolResultBuffer[toolId] = [];
      this.lastToolFlush[toolId] = Date.now();
    }
    
    // Add to buffer
    this.toolResultBuffer[toolId].push(data);
    
    // Check if we should flush
    const bufferSize = this.toolResultBuffer[toolId].length;
    const timeSinceLastFlush = Date.now() - this.lastToolFlush[toolId];
    
    // Flush if buffer is full or enough time has passed
    if (bufferSize >= this.maxBufferSize || timeSinceLastFlush >= this.flushIntervalMs) {
      this.flushToolBuffer(toolId);
    } else {
      // Schedule a flush after the interval
      setTimeout(() => {
        if (this.toolResultBuffer[toolId]?.length > 0) {
          this.flushToolBuffer(toolId);
        }
      }, this.flushIntervalMs - timeSinceLastFlush);
    }
  }
  
  /**
   * Flush the buffer for a specific tool
   */
  private flushToolBuffer(toolId: string): void {
    if (!this.toolResultBuffer[toolId] || this.toolResultBuffer[toolId].length === 0) {
      return;
    }
    
    // Create a batched event with all buffered data
    const batchedData = {
      toolId,
      results: [...this.toolResultBuffer[toolId]],
      isBatched: true,
      batchSize: this.toolResultBuffer[toolId].length,
    };
    
    // Emit the batched event
    super.emit(WebSocketEvent.TOOL_EXECUTION_BATCH, batchedData);
    
    // Clear buffer and update last flush time
    this.toolResultBuffer[toolId] = [];
    this.lastToolFlush[toolId] = Date.now();
  }
  
  /**
   * Flush all tool buffers
   */
  public flushAllToolBuffers(): void {
    Object.keys(this.toolResultBuffer).forEach(toolId => {
      this.flushToolBuffer(toolId);
    });
  }

  /**
   * Update the connection status and emit an event
   */
  private updateConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
    this.emit('connectionStatusChanged', status);
  }

  /**
   * Manually reconnect the socket
   */
  public reconnect(): void {
    if (this.socket) {
      this.socket.connect();
    } else {
      this.initializeSocket();
    }
  }

  /**
   * Close the WebSocket connection
   */
  public disconnect(): void {
    // Flush any pending buffers
    this.flushBuffers();
    this.flushAllToolBuffers();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    if (this.flushIntervalTimer) {
      clearInterval(this.flushIntervalTimer);
      this.flushIntervalTimer = null;
    }
    
    this.updateConnectionStatus(ConnectionStatus.DISCONNECTED);
  }
  
  /**
   * Check if a session has been aborted
   * @param sessionId The session ID to check
   * @returns Whether the session has been aborted
   */
  public isSessionAborted(sessionId: string): boolean {
    return this.abortTimestamps.has(sessionId);
  }

  /**
   * Get the abort timestamp for a session
   * @param sessionId The session ID
   * @returns The timestamp or undefined if not aborted
   */
  public getAbortTimestamp(sessionId: string): number | undefined {
    return this.abortTimestamps.get(sessionId);
  }

  /**
   * Reset the service - completely clean up all resources
   * Used primarily for testing and cleanup
   */
  public reset(): void {
    console.log('RealWebSocketService: Performing thorough cleanup and reset');
    
    // 1. Properly disconnect and clean up socket.io resources
    if (this.socket) {
      try {
        // Remove all socket event listeners first
        const socketEvents = [
          WebSocketEvent.CONNECT,
          WebSocketEvent.ERROR,
          WebSocketEvent.DISCONNECT,
          WebSocketEvent.PROCESSING_STARTED,
          WebSocketEvent.PROCESSING_COMPLETED,
          WebSocketEvent.PROCESSING_ERROR,
          WebSocketEvent.PROCESSING_ABORTED,
          WebSocketEvent.TOOL_EXECUTION,
          WebSocketEvent.TOOL_EXECUTION_STARTED,
          WebSocketEvent.TOOL_EXECUTION_COMPLETED,
          WebSocketEvent.TOOL_EXECUTION_ERROR,
          WebSocketEvent.PERMISSION_REQUESTED,
          WebSocketEvent.PERMISSION_RESOLVED,
          WebSocketEvent.SESSION_UPDATED
        ];
        
        socketEvents.forEach(event => {
          if (this.socket) {
            this.socket.off(event);
            console.log(`RealWebSocketService: Removed socket event listener for ${event}`);
          }
        });
        
        // Make sure reconnection is disabled before disconnecting
        if (this.socket.io && typeof this.socket.io.reconnection === 'function') {
          this.socket.io.reconnection(false);
          console.log('RealWebSocketService: Disabled socket reconnection');
        }
        
        // Also clear any reconnection listeners on the manager
        if (this.socket.io) {
          this.socket.io.off('reconnect_attempt');
          console.log('RealWebSocketService: Removed reconnect_attempt listeners');
        }
        
        // Disconnect the socket
        this.socket.disconnect();
        console.log('RealWebSocketService: Socket disconnected');
        
        // Close and cleanup manager if possible
        if (this.socket.io && typeof this.socket.io.engine === 'object' && this.socket.io.engine) {
          if (typeof this.socket.io.engine.close === 'function') {
            this.socket.io.engine.close();
            console.log('RealWebSocketService: Socket engine closed');
          }
        }
      } catch (err) {
        console.error('RealWebSocketService: Error during socket cleanup:', err);
      }
      
      // Clear the socket reference
      this.socket = null;
    }
    
    // 2. Clear all timers and intervals
    if (this.flushIntervalTimer) {
      clearInterval(this.flushIntervalTimer);
      this.flushIntervalTimer = null;
      console.log('RealWebSocketService: Cleared flush interval');
    }
    
    // 3. Clear all data structures
    this.messageBuffer.clear();
    this.toolResultBuffer = {};
    this.lastToolFlush = {};
    this.abortTimestamps.clear();
    this.activeToolsMap.clear();
    this.isProcessingMap.clear();
    console.log('RealWebSocketService: Cleared message buffers and abort tracking');
    
    // 4. Reset all state variables
    this.currentSessionId = null;
    this.reconnectAttempts = 0;
    this.connectionStatus = ConnectionStatus.DISCONNECTED;
    console.log('RealWebSocketService: Reset state variables');
    
    // 5. Remove all EventEmitter listeners (our custom ones)
    this.removeAllListeners();
    console.log('RealWebSocketService: Removed all event listeners');
    
    // 6. Force a garbage collection hint (only in testing environments)
    if (process && process.env && process.env.NODE_ENV === 'test') {
      // This explicit null assignment can help with garbage collection
      Object.keys(this).forEach(key => {
        const k = key as keyof this;
        if (typeof this[k] === 'object' && this[k] !== null) {
          // @ts-ignore - Intentionally setting to null for GC
          this[k] = null;
        }
      });
      console.log('RealWebSocketService: Applied garbage collection hints');
      
      // In Node.js testing environments, we could force GC if available
      // This is commented out because it requires special Node.js flags
      // if (global.gc) {
      //   global.gc();
      // }
    }
    
    console.log('RealWebSocketService: Reset complete');
  }
}