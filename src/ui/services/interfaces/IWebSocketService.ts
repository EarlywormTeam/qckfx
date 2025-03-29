/**
 * Interface for WebSocket service implementations
 */
import { EventEmitter } from 'events';
import { ConnectionStatus, WebSocketEvent, WebSocketEventMap } from '@/types/api';

export interface IWebSocketService extends EventEmitter {
  // Connection methods
  connect(): void;
  disconnect(): void;
  reconnect(): void;
  
  // Session management
  joinSession(sessionId: string): void;
  leaveSession(sessionId: string): void;
  getCurrentSessionId(): string | null;
  
  // Status methods
  isConnected(): boolean;
  getConnectionStatus(): ConnectionStatus;
  
  // Abort handling
  isSessionAborted(sessionId: string): boolean;
  getAbortTimestamp(sessionId: string): number | undefined;
  
  // Testing/cleanup helpers
  reset(): void;
  
  // Event methods - inherited from EventEmitter but defined for type safety
  on(event: 'connectionStatusChanged', listener: (status: ConnectionStatus) => void): this;
  on<T extends WebSocketEvent>(event: T, listener: (data: WebSocketEventMap[T]) => void): this;
  on(event: string | symbol, listener: (...args: unknown[]) => void): this;
  off(event: string | symbol, listener: (...args: unknown[]) => void): this;
  emit(event: string | symbol, ...args: unknown[]): boolean;
}