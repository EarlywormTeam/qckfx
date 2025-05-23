import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FastEditModeIndicator } from '../FastEditModeIndicator';
import { useFastEditMode } from '../../hooks';

// Mock the useFastEditMode hook
vi.mock('../../hooks', () => ({
  useFastEditMode: vi.fn(),
}));

describe('FastEditModeIndicator', () => {
  it('should show a hint when fast edit mode is disabled', () => {
    // Mock the hook to return fast edit mode disabled
    (useFastEditMode as any).mockReturnValue({
      fastEditMode: false,
    });
    
    render(<FastEditModeIndicator sessionId="test-session" />);
    
    // Component should render a hint about the shortcut
    expect(screen.getByText('press shift+tab for auto-accept mode')).toBeInTheDocument();
  });
  
  it('should render when fast edit mode is enabled', () => {
    // Mock the hook to return fast edit mode enabled
    (useFastEditMode as any).mockReturnValue({
      fastEditMode: true,
    });
    
    render(<FastEditModeIndicator sessionId="test-session" />);
    
    // Component should render the indicator text
    expect(screen.getByText('auto-accept edits on')).toBeInTheDocument();
  });
  
  it('should pass the session ID to the useFastEditMode hook', () => {
    // Mock the hook to return fast edit mode enabled
    (useFastEditMode as any).mockReturnValue({
      fastEditMode: true,
    });
    
    render(<FastEditModeIndicator sessionId="test-session-123" />);
    
    // Session ID should be passed to the hook
    expect(useFastEditMode).toHaveBeenCalledWith('test-session-123');
  });
});