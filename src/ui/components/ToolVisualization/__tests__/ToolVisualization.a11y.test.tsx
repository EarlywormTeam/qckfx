import React from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { ToolVisualization } from '../ToolVisualization';

// Note: In a real implementation, we would use jest-axe for a11y testing
// But for this placeholder, we'll just check for the necessary ARIA attributes
describe('ToolVisualization Accessibility', () => {
  const mockCompletedTool = {
    id: 'tool-2',
    tool: 'BashTool',
    toolName: 'BashTool',
    status: 'completed' as const,
    args: { command: 'ls -la' },
    paramSummary: 'command: ls -la',
    result: 'file1.txt\nfile2.txt',
    startTime: Date.now() - 1000,
    endTime: Date.now(),
    executionTime: 1000,
  };
  
  const mockRunningTool = {
    id: 'tool-1',
    tool: 'GlobTool',
    toolName: 'GlobTool',
    status: 'running' as const,
    args: { pattern: '**/*.ts' },
    paramSummary: 'pattern: **/*.ts',
    startTime: Date.now(),
  };
  
  const mockErrorTool = {
    id: 'tool-3',
    tool: 'FileReadTool',
    toolName: 'FileReadTool',
    status: 'error' as const,
    args: { file_path: '/path/to/file.txt' },
    paramSummary: '/path/to/file.txt',
    error: { message: 'File not found' },
    startTime: Date.now() - 500,
    endTime: Date.now(),
    executionTime: 500,
  };
  
  it('should have proper role attribute', () => {
    const { container } = render(<ToolVisualization tool={mockCompletedTool} />);
    
    // Check that the component has a role of "status"
    const statusElement = container.querySelector('[role="status"]');
    expect(statusElement).toBeInTheDocument();
  });
  
  it('has proper ARIA label for completed tool', () => {
    const { container } = render(<ToolVisualization tool={mockCompletedTool} />);
    
    // Check for proper aria-label that describes the tool
    const statusElement = container.querySelector('[data-testid="tool-visualization"]');
    expect(statusElement).toHaveAttribute('aria-label', expect.stringContaining('BashTool completed'));
    expect(statusElement).toHaveAttribute('aria-label', expect.stringContaining('command: ls -la'));
  });
  
  it('has proper ARIA label for running tool', () => {
    const { container } = render(<ToolVisualization tool={mockRunningTool} />);
    
    // Check for proper aria-label that describes the tool
    const statusElement = container.querySelector('[data-testid="tool-visualization"]');
    expect(statusElement).toHaveAttribute('aria-label', expect.stringContaining('GlobTool running'));
    expect(statusElement).toHaveAttribute('aria-label', expect.stringContaining('pattern: **/*.ts'));
  });
  
  it('has proper ARIA label for error tool', () => {
    const { container } = render(<ToolVisualization tool={mockErrorTool} />);
    
    // Check for proper aria-label that describes the tool
    const statusElement = container.querySelector('[data-testid="tool-visualization"]');
    expect(statusElement).toHaveAttribute('aria-label', expect.stringContaining('FileReadTool error'));
    expect(statusElement).toHaveAttribute('aria-label', expect.stringContaining('/path/to/file.txt'));
  });
  
  it('uses aria-live attribute for running tools', () => {
    const { container } = render(<ToolVisualization tool={mockRunningTool} />);
    
    // Check that running tools have aria-live="polite"
    const statusElement = container.querySelector('[data-testid="tool-visualization"]');
    expect(statusElement).toHaveAttribute('aria-live', 'polite');
  });
  
  it('does not use aria-live for completed tools', () => {
    const { container } = render(<ToolVisualization tool={mockCompletedTool} />);
    
    // Check that completed tools have aria-live="off"
    const statusElement = container.querySelector('[data-testid="tool-visualization"]');
    expect(statusElement).toHaveAttribute('aria-live', 'off');
  });
  
  it('adds clickable style to parameters when onToggleExpand is provided', () => {
    const onToggleExpand = vi.fn();
    const { container } = render(
      <ToolVisualization tool={mockCompletedTool} onToggleExpand={onToggleExpand} />
    );
    
    // Check that parameters have cursor style when onToggleExpand is provided
    const paramsElement = container.querySelector('.mt-1.text-xs');
    expect(paramsElement).toHaveAttribute('style', expect.stringContaining('cursor: pointer'));
  });
  
  it('does not add clickable style to parameters when onToggleExpand is not provided', () => {
    const { container } = render(<ToolVisualization tool={mockCompletedTool} />);
    
    // Check that parameters do not have cursor: pointer when onToggleExpand is not provided
    const paramsElement = container.querySelector('.mt-1.text-xs');
    expect(paramsElement).toHaveAttribute('style', expect.stringContaining('cursor: default'));
  });
});