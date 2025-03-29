import { MessageType } from '@/components/Message';

export interface TerminalMessage {
  id: string;
  content: string;
  type: MessageType;
  timestamp: Date;
}

export interface TerminalState {
  messages: TerminalMessage[];
  isProcessing: boolean;
  history: string[];
  theme: {
    fontFamily: string;
    fontSize: string;
    colorScheme: 'dark' | 'light' | 'system';
  };
  
  // Streaming-related state
  isStreaming: boolean;
  typingIndicator: boolean;
  streamBuffer: string[];
}

export enum ToolState {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  ERROR = 'error',
  ABORTED = 'aborted'
}

export type TerminalAction =
  | { type: 'ADD_MESSAGE'; payload: TerminalMessage }
  | { type: 'ADD_MESSAGES'; payload: TerminalMessage[] }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'ADD_TO_HISTORY'; payload: string }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'SET_FONT_FAMILY'; payload: string }
  | { type: 'SET_FONT_SIZE'; payload: string }
  | { type: 'SET_COLOR_SCHEME'; payload: 'dark' | 'light' | 'system' }
  | { type: 'SET_TYPING_INDICATOR'; payload: boolean }
  | { type: 'SET_STREAMING'; payload: boolean }
  | { type: 'ADD_TO_STREAM_BUFFER'; payload: string }
  | { type: 'CLEAR_STREAM_BUFFER' };