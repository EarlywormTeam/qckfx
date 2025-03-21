// Basic API response and request types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

export interface SessionStartRequest {
  modelOptions?: {
    model?: string;
    temperature?: number;
  };
}

export interface QueryRequest {
  query: string;
}

export interface SessionHistoryEntry {
  role: 'user' | 'assistant';
  content: Array<{
    type: 'text';
    text: string;
    citations?: any[] | null;
  }>;
}

export interface SessionData {
  id: string;
  startTime: string;
  status: 'idle' | 'thinking' | 'error';
  history: SessionHistoryEntry[];
}

export interface AgentStatus {
  sessionId: string;
  status: 'idle' | 'thinking' | 'error';
  lastActivityTime: string;
}

export interface PermissionRequest {
  id: string;
  toolId: string;
  args: Record<string, unknown>;
  timestamp: string;
}

export interface PermissionResolveRequest {
  id: string;
  granted: boolean;
}