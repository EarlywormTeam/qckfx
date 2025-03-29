import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ToolVisualization } from '../ToolVisualization';
import { ToolState } from '../../../types/terminal';

// Mock the WebSocketTerminalContext functions
vi.mock('../../../context/WebSocketTerminalContext', () => ({
  getAbortedTools: () => new Set(['aborted-tool-id']),
  isEventAfterAbort: () => false,
}));

describe('ToolVisualization Abort State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders aborted tool state correctly', () => {
    render(
      <ToolVisualization
        tool={{
          id: 'aborted-tool-id',
          name: 'TestTool',
          state: ToolState.ABORTED,
          args: { test: 'arg' },
          result: {
            aborted: true,
            message: 'Operation aborted by user'
          },
          timestamp: new Date().toISOString(),
          toolName: 'TestTool',
          status: 'aborted'
        }}
        sessionId="test-session-id"
      />
    );
    
    // Look for the aborted state by aria-label
    expect(screen.getByRole('status', { name: 'Aborted' })).toBeInTheDocument();
    expect(screen.getByText('Operation aborted')).toBeInTheDocument();
  });
  
  it('transitions running tool to aborted state when in aborted tools list', () => {
    const { rerender } = render(
      <ToolVisualization
        tool={{
          id: 'aborted-tool-id',
          name: 'TestTool',
          state: ToolState.RUNNING,
          args: { test: 'arg' },
          timestamp: new Date().toISOString(),
          toolName: 'TestTool',
          status: 'running'
        }}
        sessionId="test-session-id"
      />
    );
    
    // Re-render to trigger the useEffect that checks aborted tools
    rerender(
      <ToolVisualization
        tool={{
          id: 'aborted-tool-id',
          name: 'TestTool',
          state: ToolState.RUNNING,
          args: { test: 'arg' },
          timestamp: new Date().toISOString(),
          toolName: 'TestTool',
          status: 'running'
        }}
        sessionId="test-session-id"
      />
    );
    
    // Should be in aborted state - check by tool-status attribute
    expect(screen.getByTestId('tool-visualization')).toHaveAttribute('data-tool-status', 'aborted');
  });
  
  it('does not change state for tools not in aborted list', () => {
    render(
      <ToolVisualization
        tool={{
          id: 'normal-tool-id', // Note: not in the mocked aborted tools set
          name: 'TestTool',
          state: ToolState.RUNNING,
          args: { test: 'arg' },
          timestamp: new Date().toISOString(),
          toolName: 'TestTool',
          status: 'running'
        }}
        sessionId="test-session-id"
      />
    );
    
    // Should still show as running
    expect(screen.getByRole('status', { name: 'Running' })).toBeInTheDocument();
    expect(screen.queryByText('Aborted')).not.toBeInTheDocument();
  });
});