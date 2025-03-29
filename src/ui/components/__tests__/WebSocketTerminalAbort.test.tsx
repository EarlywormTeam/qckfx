import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { WebSocketTerminal } from '../WebSocketTerminal';

// Mock for abortProcessing function
const abortProcessingMock = vi.fn();

// Mock for context
let isProcessingValue = true;

// Mock FastEditModeIndicator component to avoid test issues
vi.mock('../FastEditModeIndicator', () => ({
  default: () => <div data-testid="mock-fast-edit-mode-indicator">Fast Edit Mode Indicator</div>
}));

// Mock the WebSocketTerminalContext
vi.mock('../../context/WebSocketTerminalContext', () => ({
  WebSocketTerminalProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useWebSocketTerminal: () => ({
    isProcessing: isProcessingValue,
    isStreaming: false,
    isConnected: true,
    connectionStatus: 'connected',
    sessionId: 'test-session-id',
    abortProcessing: abortProcessingMock,
    handleCommand: vi.fn(),
    createSession: vi.fn(),
    hasPendingPermissions: false,
    resolvePermission: vi.fn(),
  }),
}));

// Mock the TerminalContext
vi.mock('../../context/TerminalContext', () => ({
  TerminalProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useTerminal: () => ({
    state: {
      messages: [],
      theme: {
        colorScheme: 'dark',
        fontFamily: 'monospace',
        fontSize: 'md',
      },
    },
    clearMessages: vi.fn(),
    joinSession: vi.fn(),
    leaveSession: vi.fn(),
    typingIndicator: false,
  }),
}));

// Mock useAbortShortcuts hook
vi.mock('../../hooks/useAbortShortcuts', () => ({
  useAbortShortcuts: () => ({
    shortcuts: [
      {
        key: 'c',
        ctrlKey: true,
        action: vi.fn(),
        description: 'Ctrl+C: Abort current operation',
      },
      {
        key: 'Escape',
        action: vi.fn(),
        description: 'Esc: Abort current operation',
      },
    ],
    abortProcessing: vi.fn(),
  }),
  default: () => ({
    shortcuts: [
      {
        key: 'c',
        ctrlKey: true,
        action: vi.fn(),
        description: 'Ctrl+C: Abort current operation',
      },
      {
        key: 'Escape',
        action: vi.fn(),
        description: 'Esc: Abort current operation',
      },
    ],
    abortProcessing: vi.fn(),
  }),
}));

// Mock the Terminal component - remove its abort button to avoid duplicate buttons
vi.mock('../Terminal/Terminal', () => ({
  default: ({ children }: { children?: React.ReactNode}) => (
    <div data-testid="mock-terminal">
      {children}
    </div>
  )
}));

// Mock useFastEditMode hook with default export
vi.mock('../../hooks/useFastEditMode', () => {
  const useFastEditModeMock = () => ({
    isEnabled: false,
    toggle: vi.fn(),
    isLoading: false,
  });
  
  return {
    useFastEditMode: useFastEditModeMock,
    default: useFastEditModeMock,
  };
});

// Mock API client
vi.mock('../../services/apiClient', () => {
  return {
    default: {
      getFastEditMode: vi.fn().mockResolvedValue({ fastEditMode: false }),
      toggleFastEditMode: vi.fn().mockResolvedValue({ success: true }),
    }
  };
});

describe('WebSocketTerminal Abort Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset isProcessing to true for most tests
    isProcessingValue = true;
  });

  it('renders abort button when processing', () => {
    render(
      <WebSocketTerminal />
    );
    
    const abortButton = screen.getByTestId('abort-button');
    expect(abortButton).toBeInTheDocument();
    expect(abortButton).toHaveAttribute('title', expect.stringContaining('Ctrl+C or Esc'));
  });
  
  it('calls abortProcessing when abort button is clicked', async () => {
    render(
      <WebSocketTerminal />
    );
    
    const abortButton = screen.getByTestId('abort-button');
    fireEvent.click(abortButton);
    
    await waitFor(() => {
      expect(abortProcessingMock).toHaveBeenCalledTimes(1);
    });
  });
  
  it('does not show abort button when not processing', () => {
    // Set isProcessing to false for this test
    isProcessingValue = false;
    
    render(
      <WebSocketTerminal />
    );
    
    const abortButton = screen.queryByTestId('abort-button');
    expect(abortButton).not.toBeInTheDocument();
  });
});