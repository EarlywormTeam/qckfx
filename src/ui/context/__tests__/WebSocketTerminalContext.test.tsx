/**
 * Tests for WebSocketTerminalContext
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import { ConnectionStatus } from '@/types/api';
import React from 'react';

// Mock the SocketConnectionManager from the websocket utils
vi.mock('@/utils/websocket', () => {
  const mockSocketConnectionManager = {
    on: vi.fn(),
    off: vi.fn(),
    joinSession: vi.fn(),
    leaveSession: vi.fn(),
    getSessionState: vi.fn().mockReturnValue({
      currentSessionId: 'test-session-id',
      hasJoined: true,
      pendingSession: null
    }),
    emit: vi.fn(),
    getCurrentSessionId: vi.fn().mockReturnValue('test-session-id')
  };
  
  return {
    getSocketConnectionManager: vi.fn().mockReturnValue(mockSocketConnectionManager)
  };
});

// Create mock for all module dependencies first
vi.mock('@/hooks/useTerminalWebSocket', () => ({
  useTerminalWebSocket: vi.fn().mockReturnValue({
    isConnected: true,
    connectionStatus: ConnectionStatus.CONNECTED,
    connect: vi.fn(),
    disconnect: vi.fn(),
    hasJoined: true,
    sessionId: 'test-session-id',
    contextSessionId: 'test-session-id',
  })
}));

vi.mock('@/hooks/useStreamingMessages', () => ({
  useStreamingMessages: vi.fn().mockReturnValue({
    isStreaming: false,
  })
}));

vi.mock('@/hooks/useTerminalCommands', () => ({
  useTerminalCommands: vi.fn().mockReturnValue({
    handleCommand: vi.fn(),
  })
}));

vi.mock('@/hooks/usePermissionManager', () => ({
  usePermissionManager: vi.fn().mockReturnValue({
    hasPendingPermissions: false,
    resolvePermission: vi.fn().mockResolvedValue(true),
  })
}));

vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: vi.fn().mockReturnValue({
    isConnected: true,
    connectionStatus: ConnectionStatus.CONNECTED,
    currentSessionId: 'test-session-id',
    subscribe: vi.fn(),
  })
}));

vi.mock('@/hooks/useToolStream', () => ({
  useToolStream: vi.fn().mockReturnValue({
    getActiveTools: vi.fn().mockReturnValue([]),
    hasActiveTools: false,
    activeToolCount: 0,
  })
}));

vi.mock('@/context/TerminalContext', () => ({
  useTerminal: vi.fn().mockReturnValue({
    addSystemMessage: vi.fn(),
    addUserMessage: vi.fn(),
    addAssistantMessage: vi.fn(),
    addToolMessage: vi.fn(),
    addErrorMessage: vi.fn(),
    setProcessing: vi.fn(),
    state: { isProcessing: false, messages: [], history: [] },
    dispatch: vi.fn(),
    addMessage: vi.fn(),
    clearMessages: vi.fn(),
    addToHistory: vi.fn(),
  }),
  TerminalProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children)
}));

vi.mock('@/services/apiClient', () => ({
  default: {
    startSession: vi.fn().mockResolvedValue({ 
      success: true, 
      data: { sessionId: 'test-session-id' } 
    }),
    abortOperation: vi.fn().mockResolvedValue({ success: true }),
  }
}));

vi.mock('@/services/WebSocketService', () => ({
  getWebSocketService: vi.fn().mockReturnValue({
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  })
}));

// Create individual mocks for the methods we need to test
const mockAddSystemMessage = vi.fn();
const mockAddErrorMessage = vi.fn();
const mockHandleCommand = vi.fn();
const mockResolvePermission = vi.fn().mockResolvedValue(true);
const mockStartSession = vi.fn().mockResolvedValue({ 
  success: true, 
  data: { sessionId: 'test-session-id' } 
});
const mockAbortOperation = vi.fn().mockResolvedValue({ success: true });
const mockConnectToSession = vi.fn().mockReturnValue(true);

// Get references to the module functions to access mock implementations
import { useTerminalWebSocket } from '@/hooks/useTerminalWebSocket';
  
import { useTerminalCommands } from '@/hooks/useTerminalCommands';
import { usePermissionManager } from '@/hooks/usePermissionManager';
import { useTerminal } from '@/context/TerminalContext';
import apiClient from '@/services/apiClient';
import { getSocketConnectionManager } from '@/utils/websocket';

// Update mock references for easier testing
vi.mocked(useTerminal).mockReturnValue({
  addSystemMessage: mockAddSystemMessage,
  addErrorMessage: mockAddErrorMessage,
  addUserMessage: vi.fn(),
  addAssistantMessage: vi.fn(),
  setProcessing: vi.fn(),
  isProcessing: false,
  state: { 
    isProcessing: false, 
    isStreaming: false,
    messages: [], 
    history: [],
    theme: {
      fontFamily: 'monospace',
      fontSize: '14px',
      colorScheme: 'dark'
    },
    typingIndicator: false,
    streamBuffer: [],
  },
  dispatch: vi.fn(),
  addMessage: vi.fn(),
  clearMessages: vi.fn(),
  addToHistory: vi.fn(),
  joinSession: vi.fn(),
  leaveSession: vi.fn(),
  isStreaming: false,
  typingIndicator: false,
  streamBuffer: [],
});

vi.mocked(useTerminalCommands).mockReturnValue({
  handleCommand: mockHandleCommand,
});

vi.mocked(usePermissionManager).mockReturnValue({
  pendingPermissions: [],
  hasPendingPermissions: false,
  resolvePermission: mockResolvePermission,
});

vi.mocked(useTerminalWebSocket).mockReturnValue({
  isConnected: true,
  connectionStatus: ConnectionStatus.CONNECTED,
  connect: mockConnectToSession,
  disconnect: vi.fn(),
  hasJoined: true,
  sessionId: 'test-session-id',
  contextSessionId: 'test-session-id',
});

// Mock API client functions
apiClient.startSession = mockStartSession;
apiClient.abortOperation = mockAbortOperation;

// Now import the component after all mocks are set up
import { WebSocketTerminalProvider, useWebSocketTerminal } from '../WebSocketTerminalContext';

describe('WebSocketTerminalContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mock implementations for the specific mock functions we're testing
    mockStartSession.mockResolvedValue({ 
      success: true, 
      data: { sessionId: 'test-session-id' } 
    });
    
    mockAbortOperation.mockResolvedValue({ success: true });
    
    mockResolvePermission.mockResolvedValue(true);
    
    // Reset the terminal mock functions needed for verification
    mockAddSystemMessage.mockClear();
    mockAddErrorMessage.mockClear();
    mockHandleCommand.mockClear();
    
    // Reset the connection manager mock
    const connectionManager = getSocketConnectionManager();
    vi.mocked(connectionManager.getSessionState).mockReturnValue({
      currentSessionId: 'test-session-id',
      hasJoined: true,
      pendingSession: null
    });
  });
  
  it('should provide session-related properties and methods', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WebSocketTerminalProvider initialSessionId="test-session">
        {children}
      </WebSocketTerminalProvider>
    );
    
    const { result } = renderHook(() => useWebSocketTerminal(), { wrapper });
    
    // Check that the context provides the expected properties
    expect(result.current.sessionId).toBe('test-session');
    expect(result.current.isConnected).toBe(true);
    expect(result.current.connectionStatus).toBe(ConnectionStatus.CONNECTED);
    expect(typeof result.current.createSession).toBe('function');
    expect(typeof result.current.handleCommand).toBe('function');
    expect(typeof result.current.abortProcessing).toBe('function');
    expect(typeof result.current.resolvePermission).toBe('function');
  });
  
  it('should create a session if none is provided', async () => {
    // Use act to handle async operations
    await act(async () => {
      // Render the provider without an initial session ID
      render(
        <WebSocketTerminalProvider>
          <div data-testid="child">Child Component</div>
        </WebSocketTerminalProvider>
      );
    });
    
    // Verify child renders
    expect(screen.getByTestId('child')).toBeInTheDocument();
    
    // Verify session creation was called
    expect(mockStartSession).toHaveBeenCalled();
    expect(mockAddSystemMessage).toHaveBeenCalledWith('Creating new session...');
  });
  
  it('should handle abort operation', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WebSocketTerminalProvider initialSessionId="test-session">
        {children}
      </WebSocketTerminalProvider>
    );
    
    const { result } = renderHook(() => useWebSocketTerminal(), { wrapper });
    
    // Call abort processing
    await act(async () => {
      await result.current.abortProcessing();
    });
    
    // Verify API call was made with sessionId
    expect(mockAbortOperation).toHaveBeenCalledWith('test-session');
  });
  
  it('should handle error when creating a session', async () => {
    // Mock API error
    mockStartSession.mockRejectedValueOnce(new Error('API error'));
    
    // Render the provider without an initial session ID
    render(
      <WebSocketTerminalProvider>
        <div data-testid="child">Child Component</div>
      </WebSocketTerminalProvider>
    );
    
    // Wait for async operations
    await vi.waitFor(() => {
      expect(mockAddErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create session: API error')
      );
    });
  });
  
  it('should handle command submission', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WebSocketTerminalProvider initialSessionId="test-session">
        {children}
      </WebSocketTerminalProvider>
    );
    
    const { result } = renderHook(() => useWebSocketTerminal(), { wrapper });
    
    await act(async () => {
      await result.current.handleCommand('test command');
    });
    
    expect(mockHandleCommand).toHaveBeenCalledWith('test command');
  });
  
  it('should handle permission resolution', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WebSocketTerminalProvider initialSessionId="test-session">
        {children}
      </WebSocketTerminalProvider>
    );
    
    const { result } = renderHook(() => useWebSocketTerminal(), { wrapper });
    
    await act(async () => {
      await result.current.resolvePermission('permission-1', true);
    });
    
    expect(mockResolvePermission).toHaveBeenCalledWith('permission-1', true);
  });
  
  it('should handle error when aborting processing', async () => {
    // Mock API error
    mockAbortOperation.mockRejectedValueOnce(new Error('Abort error'));
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WebSocketTerminalProvider initialSessionId="test-session">
        {children}
      </WebSocketTerminalProvider>
    );
    
    const { result } = renderHook(() => useWebSocketTerminal(), { wrapper });
    
    await act(async () => {
      await result.current.abortProcessing();
    });
    
    expect(mockAddErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Failed to abort: Abort error')
    );
  });
  
  it('should handle error response when aborting', async () => {
    // Mock API error response
    mockAbortOperation.mockResolvedValueOnce({ 
      success: false, 
      error: { message: 'Failed to abort' } 
    });
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WebSocketTerminalProvider initialSessionId="test-session">
        {children}
      </WebSocketTerminalProvider>
    );
    
    const { result } = renderHook(() => useWebSocketTerminal(), { wrapper });
    
    await act(async () => {
      await result.current.abortProcessing();
    });
    
    expect(mockAddErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Failed to abort: Failed to abort')
    );
  });
  
  it('should connect to session when created successfully', async () => {
    let hookResult: any;
    
    // Properly wrap the component rendering and state updates in act
    await act(async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketTerminalProvider>
          {children}
        </WebSocketTerminalProvider>
      );
      
      const renderResult = renderHook(() => useWebSocketTerminal(), { wrapper });
      hookResult = renderResult;
      
      // Wait for any pending state updates
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    // Verify the expected behavior
    expect(mockStartSession).toHaveBeenCalled();
    expect(mockAddSystemMessage).toHaveBeenCalledWith('Session created: test-session-id');
    expect(mockConnectToSession).toHaveBeenCalledWith('test-session-id');
  });
});