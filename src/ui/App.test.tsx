import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@/test/utils';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByText(/Welcome to qckfx Terminal/i)).toBeInTheDocument();
  });

  it('displays the assistant message', () => {
    render(<App />);
    expect(screen.getByText(/How can I help you today?/i)).toBeInTheDocument();
  });

  it('renders the terminal component', () => {
    render(<App />);
    expect(screen.getByTestId('terminal-container')).toBeInTheDocument();
  });

  it('handles user commands and displays responses', () => {
    render(<App />);
    
    // Find the input field
    const inputField = screen.getByTestId('input-field');
    
    // Type a command
    act(() => {
      fireEvent.change(inputField, { target: { value: 'hello world' } });
      // Submit the command
      fireEvent.keyDown(inputField, { key: 'Enter' });
    });
    
    // Verify user message is displayed
    const userMessages = screen.getAllByText('hello world');
    expect(userMessages.length).toBeGreaterThan(0);
    
    // Fast-forward timer to trigger the response
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    // Verify response is displayed
    const responses = screen.getAllByText('You said: hello world');
    expect(responses.length).toBeGreaterThan(0);
  });
  
  it('clears the terminal when clear function is triggered', () => {
    render(<App />);
    
    // Click the ? button to show shortcuts
    fireEvent.click(screen.getByTestId('show-shortcuts'));
    
    // Verify shortcuts panel is displayed
    expect(screen.getByTestId('shortcuts-panel')).toBeInTheDocument();
    
    // Get the terminal container
    const terminal = screen.getByTestId('terminal-container');
    
    // Simulate Ctrl+L keyboard shortcut
    fireEvent.keyDown(terminal, { key: 'l', ctrlKey: true });
    
    // Verify welcome messages are cleared and "Terminal cleared" message is shown
    expect(screen.queryByText(/Welcome to qckfx Terminal/i)).not.toBeInTheDocument();
    
    // Get all "Terminal cleared" messages (there might be multiple due to announcer)
    const clearMessages = screen.getAllByText('Terminal cleared');
    expect(clearMessages.length).toBeGreaterThan(0);
  });
});