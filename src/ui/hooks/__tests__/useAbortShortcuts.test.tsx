import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useAbortShortcuts } from '../useAbortShortcuts';
import { WebSocketTerminalProvider, useWebSocketTerminal } from '../../context/WebSocketTerminalContext';

// Mock the WebSocketTerminalContext
const abortProcessingMock = vi.fn();

vi.mock('../../context/WebSocketTerminalContext', () => ({
  WebSocketTerminalProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useWebSocketTerminal: () => ({
    isProcessing: true,
    abortProcessing: abortProcessingMock,
    sessionId: 'test-session-id',
  }),
}));

// Test component
function TestComponent() {
  const { shortcuts } = useAbortShortcuts();
  return (
    <div data-testid="test-component">
      <ul>
        {shortcuts.map((shortcut, index) => (
          <li key={index}>
            {shortcut.key} - {shortcut.description}
          </li>
        ))}
      </ul>
    </div>
  );
}

describe('useAbortShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers both Ctrl+C and Esc shortcuts', () => {
    render(
      <WebSocketTerminalProvider>
        <TestComponent />
      </WebSocketTerminalProvider>
    );
    
    const component = screen.getByTestId('test-component');
    expect(component.textContent).toContain('c - Ctrl+C: Abort current operation');
    expect(component.textContent).toContain('Escape - Esc: Abort current operation');
  });
  
  it('calls abortProcessing when Ctrl+C is pressed', () => {
    const { container } = render(
      <WebSocketTerminalProvider>
        <TestComponent />
      </WebSocketTerminalProvider>
    );
    
    fireEvent.keyDown(container, { key: 'c', ctrlKey: true, bubbles: true });
    
    expect(abortProcessingMock).toHaveBeenCalledTimes(1);
  });
  
  it('calls abortProcessing when Esc is pressed outside an input field', () => {
    const { container } = render(
      <WebSocketTerminalProvider>
        <TestComponent />
      </WebSocketTerminalProvider>
    );
    
    fireEvent.keyDown(container, { key: 'Escape', bubbles: true });
    
    expect(abortProcessingMock).toHaveBeenCalledTimes(1);
  });
  
  it('does not call abortProcessing when Esc is pressed in a non-empty input field', () => {
    render(
      <WebSocketTerminalProvider>
        <div>
          <input data-testid="test-input" type="text" defaultValue="some text" />
          <TestComponent />
        </div>
      </WebSocketTerminalProvider>
    );
    
    const input = screen.getByTestId('test-input');
    input.focus();
    fireEvent.keyDown(input, { key: 'Escape', bubbles: true });
    
    expect(abortProcessingMock).not.toHaveBeenCalled();
  });
  
  it('calls abortProcessing when Esc is pressed in an empty input field', () => {
    render(
      <WebSocketTerminalProvider>
        <div>
          <input data-testid="test-input" type="text" defaultValue="" />
          <TestComponent />
        </div>
      </WebSocketTerminalProvider>
    );
    
    const input = screen.getByTestId('test-input');
    input.focus();
    fireEvent.keyDown(input, { key: 'Escape', bubbles: true });
    
    expect(abortProcessingMock).toHaveBeenCalledTimes(1);
  });
});