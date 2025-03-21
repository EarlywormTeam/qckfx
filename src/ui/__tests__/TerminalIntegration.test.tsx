import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Terminal } from '@/components/Terminal/Terminal';
import { TerminalProvider, useTerminal } from '@/context/TerminalContext';
import { vi } from 'vitest';

// Test App component for integration testing
const TestApp = () => {
  return (
    <TerminalProvider>
      <div className="app-container">
        <TerminalContainer />
      </div>
    </TerminalProvider>
  );
};

// Terminal container that uses the context
const TerminalContainer = () => {
  const { 
    state, 
    addUserMessage, 
    addAssistantMessage, 
    addSystemMessage,
    clearMessages
  } = useTerminal();
  
  const handleCommand = (command: string) => {
    // Add user command
    addUserMessage(command);
    
    // Simulate response delay
    setTimeout(() => {
      if (command.toLowerCase() === 'clear') {
        clearMessages();
        addSystemMessage('Terminal cleared');
      } else if (command.toLowerCase() === 'help') {
        addSystemMessage('Available commands: help, clear, echo');
      } else if (command.toLowerCase().startsWith('echo ')) {
        const content = command.substring(5);
        addAssistantMessage(content);
      } else {
        addAssistantMessage(`Command not recognized: ${command}`);
      }
    }, 100);
  };
  
  return (
    <Terminal 
      messages={state.messages}
      onCommand={handleCommand}
      onClear={() => clearMessages()}
      inputDisabled={state.isProcessing}
    />
  );
};

describe('Terminal Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  it('renders a terminal interface', () => {
    render(<TestApp />);
    
    // Verify terminal is rendered
    const terminal = screen.getByTestId('terminal-container');
    expect(terminal).toBeInTheDocument();
    
    // Verify input field is rendered
    const input = screen.getByTestId('input-field');
    expect(input).toBeInTheDocument();
  });
  
  it('processes basic echo command', async () => {
    render(<TestApp />);
    
    // Get the input field
    const input = screen.getByTestId('input-field');
    
    // Enter and submit a command
    fireEvent.change(input, { target: { value: 'echo Hello World' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    // Advance timers to trigger the setTimeout response
    act(() => {
      vi.advanceTimersByTime(200);
    });
    
    // Check if the response appears
    expect(screen.getAllByText('Hello World').length).toBeGreaterThan(0);
  });
  
  it('processes help command', async () => {
    render(<TestApp />);
    
    // Get the input field
    const input = screen.getByTestId('input-field');
    
    // Enter help command
    fireEvent.change(input, { target: { value: 'help' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    // Advance timers to trigger the setTimeout response
    act(() => {
      vi.advanceTimersByTime(200);
    });
    
    // Verify help text appears
    const helpElements = screen.getAllByText(/Available commands/i);
    expect(helpElements.length).toBeGreaterThan(0);
  });
});