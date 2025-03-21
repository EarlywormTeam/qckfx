import React from 'react';
import { render, screen } from '@testing-library/react';
import { Message } from '../Message';

describe('Message Component', () => {
  it('renders user message correctly', () => {
    render(<Message content="User input" type="user" />);
    
    const message = screen.getByTestId('message');
    expect(message).toHaveAttribute('data-message-type', 'user');
    expect(message).toHaveTextContent('User input');
  });
  
  it('renders assistant message correctly', () => {
    render(<Message content="Assistant response" type="assistant" />);
    
    const message = screen.getByTestId('message');
    expect(message).toHaveAttribute('data-message-type', 'assistant');
    expect(message).toHaveTextContent('Assistant response');
  });
  
  it('renders system message correctly', () => {
    render(<Message content="System notification" type="system" />);
    
    const message = screen.getByTestId('message');
    expect(message).toHaveAttribute('data-message-type', 'system');
    expect(message).toHaveTextContent('System notification');
  });
  
  it('renders error message correctly', () => {
    render(<Message content="Error occurred" type="error" />);
    
    const message = screen.getByTestId('message');
    expect(message).toHaveAttribute('data-message-type', 'error');
    expect(message).toHaveTextContent('Error occurred');
    expect(message).toHaveAttribute('role', 'alert'); // Error messages should have alert role
  });
  
  it('renders tool message correctly', () => {
    render(<Message content="Tool output" type="tool" />);
    
    const message = screen.getByTestId('message');
    expect(message).toHaveAttribute('data-message-type', 'tool');
    expect(message).toHaveTextContent('Tool output');
  });
  
  it('shows timestamp when provided', () => {
    const testDate = new Date('2023-01-01T12:00:00Z');
    render(<Message content="Message with time" type="system" timestamp={testDate} />);
    
    // This will depend on the timezone setting of where the test runs
    // So we'll just check that the timestamp is rendered
    const messageWithTime = screen.getByTestId('message');
    expect(messageWithTime.textContent).toContain(testDate.toLocaleTimeString());
  });
  
  it('hides timestamp when showTimestamp is false', () => {
    const testDate = new Date('2023-01-01T12:00:00Z');
    render(
      <Message 
        content="Message without time" 
        type="system" 
        timestamp={testDate} 
        showTimestamp={false} 
      />
    );
    
    const messageWithoutTime = screen.getByTestId('message');
    expect(messageWithoutTime.textContent).not.toContain(testDate.toLocaleTimeString());
  });
  
  it('applies custom className', () => {
    render(<Message content="Custom styled message" type="user" className="test-class" />);
    
    const message = screen.getByTestId('message');
    expect(message).toHaveClass('test-class');
  });
  
  it('sets aria-label when provided', () => {
    render(
      <Message 
        content="Accessible message" 
        type="system" 
        ariaLabel="This is a system message" 
      />
    );
    
    const message = screen.getByTestId('message');
    expect(message).toHaveAttribute('aria-label', 'This is a system message');
  });
});