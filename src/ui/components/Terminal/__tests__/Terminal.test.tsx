import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { Terminal } from '../Terminal';
import { TerminalProvider } from '@/context/TerminalContext';
import { TerminalMessage } from '@/types/terminal';

// Mock the WebSocketTerminalContext
const mockAbortProcessing = vi.fn();
vi.mock('@/context/WebSocketTerminalContext', () => ({
  useWebSocketTerminal: () => ({
    abortProcessing: mockAbortProcessing,
    hasJoined: true,
    sessionId: 'test-session-id',
    getAbortedTools: () => new Set([]),
    isEventAfterAbort: () => false,
    connectionStatus: 'connected',
    isProcessing: false,
    isConnected: true,
  }),
  WebSocketTerminalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Mock the useFastEditMode hook to prevent API calls
vi.mock('@/hooks/useFastEditMode', () => ({
  useFastEditMode: () => ({
    fastEditMode: false,
    enableFastEditMode: vi.fn(),
    disableFastEditMode: vi.fn(),
    toggleFastEditMode: vi.fn(),
  }),
  __esModule: true,
  default: () => ({
    fastEditMode: false,
    enableFastEditMode: vi.fn(),
    disableFastEditMode: vi.fn(),
    toggleFastEditMode: vi.fn(),
  })
}));

// Mock the useToolVisualization hook
vi.mock('@/hooks/useToolVisualization', () => ({
  useToolVisualization: () => ({
    tools: [],
    activeTools: [],
    recentTools: [],
    hasActiveTools: false,
    activeToolCount: 0,
    getToolById: () => undefined,
    setToolViewMode: vi.fn(),
    setDefaultViewMode: vi.fn(),
    defaultViewMode: 'brief'
  })
}));

// Mock the ToolPreferencesContext
vi.mock('@/context/ToolPreferencesContext', () => ({
  useToolPreferencesContext: () => ({
    preferences: {
      defaultViewMode: 'brief',
      persistPreferences: true,
      toolOverrides: {}
    },
    initialized: true,
    setDefaultViewMode: vi.fn(),
    setToolViewMode: vi.fn(),
    togglePersistPreferences: vi.fn(),
    resetPreferences: vi.fn(),
    getToolViewMode: vi.fn(() => 'brief'),
    clearToolOverride: vi.fn()
  }),
  ToolPreferencesProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Mock the ThemeProvider
vi.mock('@/components/ThemeProvider', () => ({
  useTheme: () => ({
    theme: 'dark',
  }),
}));

// Wrap component in providers
const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <TerminalProvider>
      {ui}
    </TerminalProvider>
  );
};

const mockMessages: TerminalMessage[] = [
  {
    id: '1',
    content: [{ type: 'text', text: 'System message' }],
    type: 'system',
    timestamp: new Date(),
  },
  {
    id: '2',
    content: [{ type: 'text', text: 'User message' }],
    type: 'user',
    timestamp: new Date(),
  },
  {
    id: '3',
    content: [{ type: 'text', text: 'Assistant message' }],
    type: 'assistant',
    timestamp: new Date(),
  },
];

describe('Terminal Component', () => {
  it('renders correctly with provided messages', () => {
    renderWithProviders(<Terminal messages={mockMessages} />);
    
    const systemMessages = screen.getAllByText('System message');
    const userMessages = screen.getAllByText('User message');
    const assistantMessages = screen.getAllByText('Assistant message');
    
    expect(systemMessages.length).toBeGreaterThan(0);
    expect(userMessages.length).toBeGreaterThan(0);
    expect(assistantMessages.length).toBeGreaterThan(0);
  });
  
  it('calls onCommand when command is submitted', () => {
    const mockOnCommand = vi.fn();
    renderWithProviders(<Terminal onCommand={mockOnCommand} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test command' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(mockOnCommand).toHaveBeenCalledWith('test command');
  });
  
  it('disables input when inputDisabled is true', () => {
    renderWithProviders(<Terminal inputDisabled={true} />);
    
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });
  
  it('opens shortcuts panel when ? button is clicked', async () => {
    renderWithProviders(<Terminal />);
    
    const shortcutsButton = screen.getByTestId('show-shortcuts');
    fireEvent.click(shortcutsButton);
    
    await waitFor(() => {
      // Look for the specific shortcuts panel element
      const shortcutsPanel = screen.getByTestId('shortcuts-panel');
      expect(shortcutsPanel).toBeInTheDocument();
    });
  });
  
  it('opens settings panel when settings button is clicked', async () => {
    renderWithProviders(<Terminal />);
    
    const settingsButton = screen.getByTestId('show-settings');
    fireEvent.click(settingsButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Terminal Display Settings/i)).toBeInTheDocument();
    });
  });
  
  it('calls onClear when keyboard shortcut is triggered', () => {
    const mockOnClear = vi.fn();
    renderWithProviders(<Terminal onClear={mockOnClear} />);
    
    const terminal = screen.getByTestId('terminal-container');
    
    // Determine platform to use the correct shortcut (Cmd+K on Mac, Ctrl+K elsewhere)
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    fireEvent.keyDown(terminal, { 
      key: 'k', 
      [isMac ? 'metaKey' : 'ctrlKey']: true 
    });
    
    expect(mockOnClear).toHaveBeenCalled();
  });
  
  it('applies custom font family', () => {
    renderWithProviders(
      <Terminal 
        theme={{ 
          fontFamily: '"Courier New", monospace', 
          fontSize: 'md', 
          colorScheme: 'dark'
        }} 
      />
    );
    
    const terminal = screen.getByTestId('terminal-container');
    expect(terminal.style.fontFamily).toBe('"Courier New", monospace');
  });
  
  it('applies correct color scheme', () => {
    renderWithProviders(
      <Terminal 
        theme={{ 
          fontFamily: 'monospace', 
          fontSize: 'md', 
          colorScheme: 'light'
        }} 
      />
    );
    
    const terminal = screen.getByTestId('terminal-container');
    expect(terminal).toHaveClass('theme-light');
  });
  
  it('applies appropriate aria attributes for accessibility', () => {
    renderWithProviders(<Terminal ariaLabel="Test Terminal" />);
    
    const terminal = screen.getByTestId('terminal-container');
    expect(terminal).toHaveAttribute('role', 'application');
    expect(terminal).toHaveAttribute('aria-label', 'Test Terminal');
    
    // Check for screen reader assistance
    expect(screen.getByRole('log')).toBeInTheDocument();
    expect(screen.getByRole('form')).toBeInTheDocument();
  });
});