import React, { createContext, useContext, useReducer, ReactNode, useEffect, useCallback } from 'react';
import { TerminalState, TerminalAction, TerminalMessage } from '../types/terminal';
import { MessageType } from '../components/Message';
import { WebSocketEvent, SessionData } from '../types/api';
import { useWebSocketContext } from './WebSocketContext';
import { PreviewMode } from '../../types/preview';
import type { ContentPart } from '@qckfx/agent/browser';

// Initial state
const initialState: TerminalState = {
  messages: [
    {
      id: 'greeting',
      content: [{ type: 'text', text: 'How can I help you today?' }],
      type: 'assistant',
      timestamp: Date.now(),
    },
  ],
  isProcessing: false,
  history: [],
  theme: {
    fontFamily: 'monospace',
    fontSize: 'md',
    colorScheme: 'dark',
  },
  // Streaming state
  isStreaming: false,
  typingIndicator: false,
  streamBuffer: [],
  
  // Add default preview preferences
  previewPreferences: {
    defaultViewMode: PreviewMode.BRIEF,
    persistPreference: true,
    toolOverrides: {}
  }
};

// Terminal reducer
function terminalReducer(state: TerminalState, action: TerminalAction): TerminalState {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };
      
    case 'ADD_MESSAGES':
      return {
        ...state,
        messages: [...state.messages, ...action.payload],
      };
      
    case 'CLEAR_MESSAGES':
      return {
        ...state,
        messages: [
          // No need for a message after clearing
        ],
      };
      
    case 'SET_PROCESSING':
      return {
        ...state,
        isProcessing: action.payload,
        // Always synchronize typing indicator with processing state
        // If processing is turned off, also turn off the typing indicator
        typingIndicator: action.payload ? state.typingIndicator : false,
      };
      
    case 'ADD_TO_HISTORY': {
      // Avoid duplicates at the end
      if (state.history.length > 0 && state.history[state.history.length - 1] === action.payload) {
        return state;
      }
      
      // Limit history size to 50 items
      const newHistory = [...state.history, action.payload];
      if (newHistory.length > 50) {
        newHistory.shift();
      }
      
      return {
        ...state,
        history: newHistory,
      };
    }
      
    case 'CLEAR_HISTORY':
      return {
        ...state,
        history: [],
      };
      
    case 'SET_FONT_FAMILY':
      return {
        ...state,
        theme: {
          ...state.theme,
          fontFamily: action.payload,
        },
      };
      
    case 'SET_FONT_SIZE':
      return {
        ...state,
        theme: {
          ...state.theme,
          fontSize: action.payload,
        },
      };
      
    case 'SET_COLOR_SCHEME': {
      console.log('TerminalContext reducer: SET_COLOR_SCHEME', action.payload);
      const newState = {
        ...state,
        theme: {
          ...state.theme,
          colorScheme: action.payload,
        },
      };
      console.log('New terminal theme state:', newState.theme);
      return newState;
    }
      
    // Streaming-related actions
    case 'SET_TYPING_INDICATOR':
      console.log(`[TerminalContext] SET_TYPING_INDICATOR dispatch: ${action.payload}`);
      return {
        ...state,
        typingIndicator: action.payload,
      };
      
      
    case 'SET_STREAMING':
      return {
        ...state,
        isStreaming: action.payload,
      };
      
    case 'ADD_TO_STREAM_BUFFER':
      return {
        ...state,
        streamBuffer: [...state.streamBuffer, action.payload],
      };
      
    case 'CLEAR_STREAM_BUFFER':
      return {
        ...state,
        streamBuffer: [],
      };
      
    // Preview-related actions
    case 'SET_PREVIEW_MODE':
      return {
        ...state,
        previewPreferences: {
          ...state.previewPreferences,
          toolOverrides: {
            ...state.previewPreferences.toolOverrides,
            [action.payload.toolId]: {
              viewMode: action.payload.mode
            }
          }
        }
      };
      
    case 'SET_DEFAULT_PREVIEW_MODE':
      return {
        ...state,
        previewPreferences: {
          ...state.previewPreferences,
          defaultViewMode: action.payload
        }
      };
      
    case 'SET_PREVIEW_PERSISTENCE':
      return {
        ...state,
        previewPreferences: {
          ...state.previewPreferences,
          persistPreference: action.payload
        }
      };
      
    default:
      return state;
  }
}

// Context type
interface TerminalContextType {
  state: TerminalState;
  dispatch: React.Dispatch<TerminalAction>;
  
  // Helper functions
  addMessage: (content: string, type?: MessageType) => void;
  addSystemMessage: (content: string) => void;
  addUserMessage: (content: string) => void;
  addAssistantMessage: (content: string) => void;
  addErrorMessage: (content: string) => void;
  clearMessages: () => void;
  setProcessing: (isProcessing: boolean) => void;
  addToHistory: (command: string) => void;
  
  // WebSocket session management
  joinSession: (sessionId: string) => Promise<void>;
  leaveSession: () => Promise<void>;
  
  // Streaming-related properties
  isStreaming: boolean;
  isProcessing: boolean;
  typingIndicator: boolean;
  streamBuffer: string[];
}

// Create context
const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

// Provider component
export const TerminalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(terminalReducer, initialState);
  
  // Get WebSocket context
  const websocketContext = useWebSocketContext();
  
  // Tool execution is now handled by the ToolVisualization component
  
  // Set up WebSocket event handling
  useEffect(() => {
    // Skip if no websocket context available
    if (!websocketContext) return;
    
    // Handler for processing started event
    const handleProcessingStarted = ({ _sessionId }: { _sessionId: string }) => {
      console.log('[TerminalContext] PROCESSING_STARTED received, turning on typing indicator');
      dispatch({ type: 'SET_PROCESSING', payload: true });
      dispatch({ type: 'SET_TYPING_INDICATOR', payload: true });
    };
    
    // Handler for processing completed event
    const handleProcessingCompleted = ({ _sessionId, _result }: { _sessionId: string, _result: unknown }) => {
      console.log(`[TerminalContext] PROCESSING_COMPLETED received, turning off typing indicator`);
      dispatch({ type: 'SET_PROCESSING', payload: false });
      dispatch({ type: 'SET_TYPING_INDICATOR', payload: false });
      dispatch({ type: 'CLEAR_STREAM_BUFFER' });
    };
    
    // Handler for processing error event
    const handleProcessingError = ({ _sessionId, error }: { _sessionId: string, error: { name: string; message: string; stack?: string } }) => {
      // Don't show error messages for permission denials, as they're handled by the tool visualization
      const isPermissionError = error.message.includes('Permission denied');
      
      if (!isPermissionError) {
        dispatch({ 
          type: 'ADD_MESSAGE', 
          payload: {
            id: generateUniqueId('error'),
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            type: 'error',
            timestamp: Date.now()
          }
        });
      } else {
        // Just log permission errors to console but don't show in UI
        console.log('Permission denied error suppressed:', error.message);
      }
      
      dispatch({ type: 'SET_PROCESSING', payload: false });
      dispatch({ type: 'SET_TYPING_INDICATOR', payload: false });
      dispatch({ type: 'CLEAR_STREAM_BUFFER' });
    };
    
    // Handler for processing aborted event
    const handleProcessingAborted = ({ _sessionId }: { _sessionId: string }) => {
      dispatch({ 
        type: 'ADD_MESSAGE', 
        payload: {
          id: generateUniqueId('system'),
          content: [{ type: 'text', text: 'Operation stopped. You can continue with a new message.' }],
          type: 'system',
          timestamp: Date.now()
        }
      });
      dispatch({ type: 'SET_PROCESSING', payload: false });
      dispatch({ type: 'SET_TYPING_INDICATOR', payload: false });
      dispatch({ type: 'CLEAR_STREAM_BUFFER' });
    };
    
    // Handler for session updated event - displays messages from the conversation history
    const handleSessionUpdated = (sessionData: SessionData) => {
      console.log('SESSION_UPDATED event received:', JSON.stringify(sessionData, null, 2));
      
      // Check if the typing indicator should be turned off based on session state
      if (sessionData && 'isProcessing' in sessionData && sessionData.isProcessing === false && state.typingIndicator) {
        console.log('[TerminalContext] Detected non-processing session but typing indicator is on, turning it off');
        dispatch({ type: 'SET_TYPING_INDICATOR', payload: false });
      }
      
      // Add debugging to identify session structure
      if (sessionData?.state) {
        console.log('Session state exists, contextWindow available:', 
          Boolean(sessionData.state.contextWindow));
      } else if (sessionData?.history) {
        console.log('Legacy history format detected:', sessionData.history.length, 'messages');
      } else {
        console.log('No recognized history format in session data');
      }
      
      // Try both types of session data structures (state.conversationHistory or history)
      let historyToProcess = null;
      
      // First try the new structure with state.contextWindow
      if (sessionData?.state?.contextWindow && Array.isArray(sessionData.state.contextWindow)) {
        historyToProcess = sessionData.state.contextWindow;
        console.log('Using state.contextWindow with', historyToProcess.length, 'messages');
      } 
      // Then try the legacy structure with history
      else if (sessionData?.history && Array.isArray(sessionData.history)) {
        historyToProcess = sessionData.history;
        console.log('Using legacy history with', historyToProcess.length, 'messages');
      }
      
      // If we found a history array, process it
      if (historyToProcess && historyToProcess.length > 0) {
        console.log('Processing full conversation history of', historyToProcess.length, 'messages');
        
        // First, clear existing messages to avoid duplicates, but keep the welcome message
        dispatch({ type: 'CLEAR_MESSAGES' });
        
        // Re-add initial greeting 
        dispatch({ 
          type: 'ADD_MESSAGE', 
          payload: {
            id: 'greeting',
            content: [{ type: 'text', text: 'How can I help you today?' }],
            type: 'assistant',
            timestamp: Date.now(),
          }
        });
        
        // Process each message in the history
        const messagesToAdd = [];
        
        for (const message of historyToProcess) {
          // Only process user and assistant messages
          if (message && (message.role === 'user' || message.role === 'assistant')) {
            let textContent = '';
            
            // Handle different formats of message content
            if (Array.isArray(message.content)) {
              // For array content, extract all text blocks
              textContent = message.content
                .filter((item: ContentPart | string) => {
                  // Check for { type: 'text', text: string } format
                  if (typeof item === 'object' && item !== null && 'type' in item && item.type === 'text' && 'text' in item) {
                    return true;
                  }
                  // Check for simple string content
                  return typeof item === 'string';
                })
                .map((item: ContentPart | string) => {
                  if (typeof item === 'string') return item;
                  if (typeof item === 'object' && 'text' in item) return item.text;
                  return '';
                })
                .join('\n');
            } else if (typeof message.content === 'string') {
              // Handle simple string content
              textContent = message.content;
            }
            
            // Only add if there's actual content
            if (textContent.trim()) {
              messagesToAdd.push({
                id: generateUniqueId(message.role),
                content: [{ type: 'text' as const, text: textContent }],
                type: message.role,
                // Use current time for all messages from history
                timestamp: Date.now()
              });
            }
          }
        }
        
        // Add all messages at once to avoid too many re-renders
        if (messagesToAdd.length > 0) {
          console.log('Adding', messagesToAdd.length, 'messages from history');
          dispatch({ type: 'ADD_MESSAGES', payload: messagesToAdd });
        } else {
          console.log('No valid messages found in history');
        }
      } else {
        console.log('No history or empty history in session data');
      }
    };
    
    // Register event listeners using context's 'on' method which returns cleanup functions
    // Wrapper functions to handle parameter type mismatches
    const processStartedWrapper = (data: { sessionId: string }) => handleProcessingStarted({ _sessionId: data.sessionId });
    
    const processCompletedWrapper = (data: { sessionId: string, result: unknown }) => 
      handleProcessingCompleted({ _sessionId: data.sessionId, _result: data.result });
    
    const processErrorWrapper = (data: { sessionId: string, error: { name: string; message: string; stack?: string } }) => 
      handleProcessingError({ _sessionId: data.sessionId, error: data.error });
    
    const processAbortedWrapper = (data: { sessionId: string }) => 
      handleProcessingAborted({ _sessionId: data.sessionId });
    
    
    const cleanupFunctions = [
      websocketContext.on(WebSocketEvent.PROCESSING_STARTED, processStartedWrapper),
      websocketContext.on(WebSocketEvent.PROCESSING_COMPLETED, processCompletedWrapper),
      websocketContext.on(WebSocketEvent.PROCESSING_ERROR, processErrorWrapper),
      websocketContext.on(WebSocketEvent.PROCESSING_ABORTED, processAbortedWrapper),
      websocketContext.on(WebSocketEvent.SESSION_UPDATED, handleSessionUpdated)
    ];
    
    // Clean up event listeners
    return () => {
      // Call all cleanup functions
      cleanupFunctions.forEach(cleanup => cleanup && cleanup());
    };
  }, [websocketContext]);
  
  // Tool execution is now handled by the ToolVisualization component
  // No need to flush tool message buffers
  
  // Helper functions to make common actions easier
  // Use a combination of timestamp and a random string for more unique IDs
  const generateUniqueId = (prefix: string) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${random}`;
  };
  
  const addMessage = (content: string, type: MessageType = 'system') => {
    const message: TerminalMessage = {
      id: generateUniqueId(type),
      content: [{ type: 'text', text: content }],
      type,
      timestamp: Date.now(),
    };
    
    dispatch({ type: 'ADD_MESSAGE', payload: message });
  };
  
  const addSystemMessage = (content: string) => addMessage(content, 'system');
  const addUserMessage = (content: string) => addMessage(content, 'user');
  const addAssistantMessage = (content: string) => addMessage(content, 'assistant');
  const addErrorMessage = (content: string) => addMessage(content, 'error');
  
  const clearMessages = () => dispatch({ type: 'CLEAR_MESSAGES' });
  
  const setProcessing = (isProcessing: boolean) => 
    dispatch({ type: 'SET_PROCESSING', payload: isProcessing });
  
  const addToHistory = (command: string) => 
    dispatch({ type: 'ADD_TO_HISTORY', payload: command });
  
  // Add function to join a WebSocket session
  const joinSession = useCallback(async (sessionId: string) => {
    try {
      if (websocketContext) {
        await websocketContext.joinSession(sessionId);
      }
    } catch (error) {
      console.error('Error joining WebSocket session:', error);
      addErrorMessage(`Failed to connect to live updates: ${
        error instanceof Error ? error.message : String(error)
      }`);
    }
  }, [websocketContext]);
  
  // Add function to leave a WebSocket session
  const leaveSession = useCallback(async () => {
    try {
      if (websocketContext) {
        const sessionId = websocketContext.currentSessionId;
        if (sessionId) {
          await websocketContext.leaveSession(sessionId);
        }
      }
    } catch (error) {
      console.error('Error leaving WebSocket session:', error);
    }
  }, [websocketContext]);
  
  // Context value
  const value = {
    state,
    dispatch,
    addMessage,
    addSystemMessage,
    addUserMessage,
    addAssistantMessage,
    addErrorMessage,
    clearMessages,
    setProcessing,
    addToHistory,
    joinSession,
    leaveSession,
    isStreaming: state.isStreaming,
    isProcessing: state.isProcessing,
    typingIndicator: state.typingIndicator,
    streamBuffer: state.streamBuffer,
  };
  
  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  );
};

// Custom hook to use the terminal context
export const useTerminal = () => {
  const context = useContext(TerminalContext);
  
  if (context === undefined) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  
  return context;
};