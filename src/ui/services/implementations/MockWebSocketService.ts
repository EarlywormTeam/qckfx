/**
 * Mock WebSocket service implementation for testing
 * 
 * This implementation is compatible with the context-based architecture
 * and provides simulation capabilities for testing.
 */
import { EventEmitter } from 'events';
import { IWebSocketService } from '../interfaces/IWebSocketService';
import { ConnectionStatus, WebSocketEvent } from '@/types/api';

export class MockWebSocketService extends EventEmitter implements IWebSocketService {
  private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private currentSessionId: string | null = null;
  private timers: NodeJS.Timeout[] = [];
  private abortTimestamps: Map<string, number> = new Map();

  constructor() {
    super();
    
    // Start in connected state by default for easier testing
    this.connect();
  }

  /**
   * Connect to the WebSocket server (simulated)
   */
  public connect(): void {
    this.connectionStatus = ConnectionStatus.CONNECTED;
    this.emit('connectionStatusChanged', this.connectionStatus);
    this.emit('connection', { status: ConnectionStatus.CONNECTED });
  }

  /**
   * Disconnect from the WebSocket server (simulated)
   */
  public disconnect(): void {
    this.connectionStatus = ConnectionStatus.DISCONNECTED;
    this.emit('connectionStatusChanged', this.connectionStatus);
    this.emit('connection', { status: ConnectionStatus.DISCONNECTED });
  }

  /**
   * Reconnect to the WebSocket server (simulated)
   */
  public reconnect(): void {
    this.emit('connectionStatusChanged', ConnectionStatus.RECONNECTING);
    
    // Add slight delay to simulate reconnection
    const timer = setTimeout(() => this.connect(), 10);
    this.timers.push(timer);
  }

  /**
   * Join a session (simulated)
   */
  public joinSession(sessionId: string): void {
    this.currentSessionId = sessionId;
    
    // Emit join event for testing
    this.emit(WebSocketEvent.JOIN_SESSION, { sessionId });
  }

  /**
   * Leave a session (simulated)
   */
  public leaveSession(sessionId: string): void {
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null;
      
      // Emit leave event for testing
      this.emit(WebSocketEvent.LEAVE_SESSION, { sessionId });
    }
  }

  /**
   * Get the current session ID
   */
  public getCurrentSessionId(): string | null {
    return this.currentSessionId;
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
   * Reset the service state
   * This provides a complete cleanup to match the behavior of RealWebSocketService
   */
  public reset(): void {
    console.log('MockWebSocketService: Performing thorough cleanup and reset');
    
    // 1. Remove all event listeners
    this.removeAllListeners();
    
    // 2. Clear any timers
    this.timers.forEach(timer => {
      clearTimeout(timer);
      clearInterval(timer);
    });
    this.timers = [];
    
    // 3. Reset state variables
    this.connectionStatus = ConnectionStatus.DISCONNECTED;
    this.currentSessionId = null;
    this.abortTimestamps.clear();
    
    // 4. Start connected by default (after a brief delay)
    setTimeout(() => {
      this.connectionStatus = ConnectionStatus.CONNECTED;
      this.emit('connectionStatusChanged', this.connectionStatus);
    }, 0);
    
    console.log('MockWebSocketService: Reset complete');
  }
  
  /**
   * Simulation methods for testing
   */
  
  /**
   * Simulate a connection status change
   */
  public simulateConnectionStatusChange(status: ConnectionStatus): void {
    this.connectionStatus = status;
    this.emit('connectionStatusChanged', status);
  }
  
  /**
   * Simulate a WebSocket event
   */
  public simulateEvent<T extends WebSocketEvent>(event: T, data: unknown): void {
    this.emit(event, data);
  }
  
  /**
   * Helper methods for common agent events
   */
  
  public simulateProcessingStarted(sessionId: string): void {
    this.emit(WebSocketEvent.PROCESSING_STARTED, { sessionId });
  }
  
  public simulateProcessingCompleted(sessionId: string, response: string): void {
    this.emit(WebSocketEvent.PROCESSING_COMPLETED, { 
      sessionId, 
      result: { response } 
    });
  }
  
  public simulateProcessingAborted(sessionId: string): void {
    const abortTimestamp = Date.now();
    this.abortTimestamps.set(sessionId, abortTimestamp);
    
    this.emit(WebSocketEvent.PROCESSING_ABORTED, { 
      sessionId, 
      abortTimestamp,
      abortedTools: []
    });
  }
  
  public simulateToolExecution(sessionId: string, tool: string, result: unknown): void {
    this.emit(WebSocketEvent.TOOL_EXECUTION, {
      sessionId,
      tool,
      result
    });
  }
  
  public simulatePermissionRequest(sessionId: string, permission: Record<string, unknown>): void {
    this.emit(WebSocketEvent.PERMISSION_REQUESTED, {
      sessionId,
      permission
    });
  }
}