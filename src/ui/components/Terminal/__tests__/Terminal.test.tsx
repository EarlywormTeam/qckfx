import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Terminal } from '../Terminal';
import { TerminalProvider } from '@/context/TerminalContext';
import { TerminalMessage } from '@/types/terminal';

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
    content: 'System message',
    type: 'system',
    timestamp: new Date(),
  },
  {
    id: '2',
    content: 'User message',
    type: 'user',
    timestamp: new Date(),
  },
  {
    id: '3',
    content: 'Assistant message',
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
  
  it('calls onClear when Ctrl+L shortcut is triggered', () => {
    const mockOnClear = vi.fn();
    renderWithProviders(<Terminal onClear={mockOnClear} />);
    
    const terminal = screen.getByTestId('terminal-container');
    fireEvent.keyDown(terminal, { key: 'l', ctrlKey: true });
    
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