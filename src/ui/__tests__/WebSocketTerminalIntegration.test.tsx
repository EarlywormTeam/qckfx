import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { ConnectionStatus } from '@/types/api';
import { WebSocketTerminalProvider } from '@/context/WebSocketTerminalContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import { TerminalProvider } from '@/context/TerminalContext';
import WebSocketTerminal from '@/components/WebSocketTerminal';
import apiClient from '@/services/apiClient';

// Mock apiClient
vi.mock('@/services/apiClient', () => ({
  default: {
    startSession: vi.fn().mockResolvedValue({ 
      success: true, 
      data: { sessionId: 'test-session-id' } 
    }),
    sendQuery: vi.fn().mockResolvedValue({ success: true }),
    abortOperation: vi.fn().mockResolvedValue({ success: true }),
    getFastEditMode: vi.fn().mockResolvedValue({ 
      success: true, 
      data: { fastEditMode: false } 
    }),
    toggleFastEditMode: vi.fn().mockResolvedValue({ 
      success: true, 
      data: { fastEditMode: true }
    }),
  }
}));

// Mock socket.io-client
vi.mock('socket.io-client', () => {
  const mockSocket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    io: {
      on: vi.fn(),
      off: vi.fn(),
      engine: {
        transport: {
          name: 'websocket'
        }
      }
    }
  };
  
  return {
    io: vi.fn(() => mockSocket),
    default: vi.fn(() => mockSocket)
  };
});

// Mock WebSocketContext
vi.mock('@/context/WebSocketContext', () => ({
  WebSocketProvider: ({ children }: { children: React.ReactNode }) => children,
  useWebSocketContext: () => ({
    connectionStatus: ConnectionStatus.CONNECTED,
    isConnected: true,
    joinSession: vi.fn(),
    leaveSession: vi.fn(),
    on: vi.fn(() => () => {}),
    onBatch: vi.fn(() => () => {}),
    currentSessionId: 'test-session'
  })
}));

// Test component with simplified integration 
const IntegrationTestApp = () => {
  return (
    <ThemeProvider defaultTheme="dark">
      <TerminalProvider>
        <WebSocketTerminalProvider>
          <WebSocketTerminal
            fullScreen
            autoConnect={true}
            showConnectionStatus={true}
          />
        </WebSocketTerminalProvider>
      </TerminalProvider>
    </ThemeProvider>
  );
};

describe('WebSocketTerminal Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the WebSocketTerminal component', async () => {
    render(<IntegrationTestApp />);
    
    // Check the terminal is rendered
    const terminal = await screen.findByTestId('websocket-terminal');
    expect(terminal).toBeInTheDocument();
  });

  it('creates a session on initialization', async () => {
    render(<IntegrationTestApp />);
    
    // Verify startSession is called
    await waitFor(() => {
      expect(apiClient.startSession).toHaveBeenCalled();
    });
  });

  it('sends commands to the backend API', async () => {
    render(<IntegrationTestApp />);
    
    // Wait for session creation
    await waitFor(() => {
      expect(apiClient.startSession).toHaveBeenCalled();
    });
    
    // Find the input field
    const inputField = screen.getByTestId('input-field');
    
    // Enter a command
    fireEvent.change(inputField, { target: { value: 'test command' } });
    fireEvent.keyDown(inputField, { key: 'Enter' });
    
    // Verify the command is sent to the API
    await waitFor(() => {
      expect(apiClient.sendQuery).toHaveBeenCalledWith('test-session-id', 'test command');
    });
  });
});