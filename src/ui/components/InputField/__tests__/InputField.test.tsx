import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { InputField } from '../InputField';
import { vi } from 'vitest';

describe('InputField Component', () => {
  const mockSubmit = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('renders correctly', () => {
    render(<InputField onSubmit={mockSubmit} />);
    
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type a command...')).toBeInTheDocument();
  });
  
  it('handles text input correctly', () => {
    render(<InputField onSubmit={mockSubmit} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test command' } });
    
    expect(input).toHaveValue('test command');
  });
  
  it('calls onSubmit function when Enter is pressed', () => {
    render(<InputField onSubmit={mockSubmit} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test command' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(mockSubmit).toHaveBeenCalledWith('test command');
    expect(input).toHaveValue(''); // Should clear input after submit
  });
  
  it('does not call onSubmit when input is empty', () => {
    render(<InputField onSubmit={mockSubmit} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(mockSubmit).not.toHaveBeenCalled();
  });
  
  it('clears input when Escape key is pressed', () => {
    render(<InputField onSubmit={mockSubmit} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test command' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    
    expect(input).toHaveValue('');
  });
  
  it('navigates command history with arrow keys', () => {
    render(<InputField onSubmit={mockSubmit} />);
    
    const input = screen.getByRole('textbox');
    
    // Submit a few commands to build history
    fireEvent.change(input, { target: { value: 'first command' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    fireEvent.change(input, { target: { value: 'second command' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    // Navigate through history with arrow up
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('second command');
    
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('first command');
    
    // Navigate back with arrow down
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveValue('second command');
    
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveValue(''); // Back to empty when reaching the end
  });
  
  it('respects maxHistorySize setting', () => {
    render(<InputField onSubmit={mockSubmit} maxHistorySize={2} />);
    
    const input = screen.getByRole('textbox');
    
    // Submit three commands (more than the limit)
    fireEvent.change(input, { target: { value: 'first command' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    fireEvent.change(input, { target: { value: 'second command' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    fireEvent.change(input, { target: { value: 'third command' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    // First command should be dropped, only second and third remain
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('third command');
    
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('second command');
    
    // No more history entries should exist
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('second command'); // Still the same
  });
  
  it('is disabled when the disabled prop is true', () => {
    render(<InputField onSubmit={mockSubmit} disabled={true} />);
    
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
    
    // Check that onSubmit doesn't get called when disabled
    fireEvent.change(input, { target: { value: 'test command' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(mockSubmit).not.toHaveBeenCalled();
  });
  
  it('sets appropriate accessibility attributes', () => {
    render(
      <InputField 
        onSubmit={mockSubmit} 
        ariaLabel="Command input"
        ariaLabelledBy="input-label"
        id="terminal-input"
      />
    );
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-label', 'Command input');
    expect(input).toHaveAttribute('aria-labelledby', 'input-label');
    expect(input).toHaveAttribute('id', 'terminal-input');
  });
});