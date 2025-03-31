/**
 * Types for WebSocket communication
 */

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
  TOOL_STATE_UPDATE = 'tool_state_update',
  TOOL_HISTORY = 'tool_history',
}

/**
 * Extended event map to include the new event data types
 */
export interface WebSocketEventMap {
  // Existing event mappings go here (they're defined in another file or are inferred)
  
  // New events
  [WebSocketEvent.TOOL_STATE_UPDATE]: {
    sessionId: string;
    tool: {
      id: string;
      tool: string;
      toolName: string;
      status: string;
      args: Record<string, unknown>;
      startTime: number;
      endTime?: number;
      executionTime?: number;
      paramSummary?: string;
      result?: unknown;
      error?: { message: string; stack?: string; };
      permissionId?: string;
      preview?: {
        contentType: string;
        briefContent: string;
        fullContent?: string;
        metadata?: Record<string, unknown>;
      };
    };
  };
  
  [WebSocketEvent.TOOL_HISTORY]: {
    sessionId: string;
    tools: Array<{
      id: string;
      tool: string;
      toolName: string;
      status: string;
      args: Record<string, unknown>;
      startTime: number;
      endTime?: number;
      executionTime?: number;
      paramSummary?: string;
      result?: unknown;
      error?: { message: string; stack?: string; };
      permissionId?: string;
      preview?: {
        contentType: string;
        briefContent: string;
        fullContent?: string;
        metadata?: Record<string, unknown>;
      };
    }>;
  };
}