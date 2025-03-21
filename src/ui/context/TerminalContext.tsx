import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { TerminalState, TerminalAction, TerminalMessage } from '@/types/terminal';
import { MessageType } from '@/components/Message';

// Initial state
const initialState: TerminalState = {
  messages: [
    {
      id: 'welcome',
      content: 'Welcome to qckfx Terminal',
      type: 'system',
      timestamp: new Date(),
    },
    {
      id: 'greeting',
      content: 'How can I help you today?',
      type: 'assistant',
      timestamp: new Date(),
    },
    {
      id: 'example',
      content: 'This is an example of a tool output with \u001b[31mcolored text\u001b[0m.',
      type: 'tool',
      timestamp: new Date(),
    },
  ],
  isProcessing: false,
  history: [],
  theme: {
    fontFamily: 'monospace',
    fontSize: 'md',
    colorScheme: 'dark',
  },
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
          {
            id: `clear-${Date.now()}`,
            content: 'Terminal cleared',
            type: 'system',
            timestamp: new Date(),
          },
        ],
      };
      
    case 'SET_PROCESSING':
      return {
        ...state,
        isProcessing: action.payload,
      };
      
    case 'ADD_TO_HISTORY':
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
      
    case 'SET_COLOR_SCHEME':
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
  addToolMessage: (content: string) => void;
  clearMessages: () => void;
  setProcessing: (isProcessing: boolean) => void;
  addToHistory: (command: string) => void;
}

// Create context
const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

// Provider component
export const TerminalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(terminalReducer, initialState);
  
  // Helper functions to make common actions easier
  const addMessage = (content: string, type: MessageType = 'system') => {
    const message: TerminalMessage = {
      id: `${type}-${Date.now()}`,
      content,
      type,
      timestamp: new Date(),
    };
    
    dispatch({ type: 'ADD_MESSAGE', payload: message });
  };
  
  const addSystemMessage = (content: string) => addMessage(content, 'system');
  const addUserMessage = (content: string) => addMessage(content, 'user');
  const addAssistantMessage = (content: string) => addMessage(content, 'assistant');
  const addErrorMessage = (content: string) => addMessage(content, 'error');
  const addToolMessage = (content: string) => addMessage(content, 'tool');
  
  const clearMessages = () => dispatch({ type: 'CLEAR_MESSAGES' });
  
  const setProcessing = (isProcessing: boolean) => 
    dispatch({ type: 'SET_PROCESSING', payload: isProcessing });
  
  const addToHistory = (command: string) => 
    dispatch({ type: 'ADD_TO_HISTORY', payload: command });
  
  // Context value
  const value = {
    state,
    dispatch,
    addMessage,
    addSystemMessage,
    addUserMessage,
    addAssistantMessage,
    addErrorMessage,
    addToolMessage,
    clearMessages,
    setProcessing,
    addToHistory,
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