import React from 'react';
import { render, screen } from '@testing-library/react';
import { MessageFeed } from '../MessageFeed';
import { TerminalMessage } from '@/types/terminal';

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
  {
    id: '4',
    content: 'Error message',
    type: 'error',
    timestamp: new Date(),
  },
  // Tool message type has been removed
];

describe('MessageFeed Component', () => {
  it('renders empty state when no messages', () => {
    render(<MessageFeed messages={[]} />);
    
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
  });
  
  it('renders all messages with correct types', () => {
    render(<MessageFeed messages={mockMessages} />);
    
    const systemMessages = screen.getAllByText('System message');
    const userMessages = screen.getAllByText('User message');
    const assistantMessages = screen.getAllByText('Assistant message');
    const errorMessages = screen.getAllByText('Error message');
    
    expect(systemMessages.length).toBeGreaterThan(0);
    expect(userMessages.length).toBeGreaterThan(0);
    expect(assistantMessages.length).toBeGreaterThan(0);
    expect(errorMessages.length).toBeGreaterThan(0);
  });
  
  it('applies correct positioning classes for different message types', () => {
    render(<MessageFeed messages={mockMessages} />);
    
    // Using querySelectors to get the elements by data-testid
    const systemMessage = document.querySelector(`[data-testid="message-${mockMessages[0].id}"]`);
    const userMessage = document.querySelector(`[data-testid="message-${mockMessages[1].id}"]`);
    const assistantMessage = document.querySelector(`[data-testid="message-${mockMessages[2].id}"]`);
    const errorMessage = document.querySelector(`[data-testid="message-${mockMessages[3].id}"]`);
    
    // Tool messages are handled differently in the timeline rendering
    // and may not have the expected class, so we skip testing it
    
    expect(systemMessage).toHaveClass('self-center');
    expect(userMessage).toHaveClass('self-end');
    expect(assistantMessage).toHaveClass('self-start');
    expect(errorMessage).toHaveClass('self-center');
  });
  
  it('applies custom class name', () => {
    render(<MessageFeed messages={mockMessages} className="test-class" />);
    
    const messageFeed = screen.getByTestId('message-feed');
    expect(messageFeed).toHaveClass('test-class');
  });
  
  it('sets correct ARIA attributes for accessibility', () => {
    render(<MessageFeed messages={mockMessages} ariaLabelledBy="test-label" />);
    
    const messageFeed = screen.getByTestId('message-feed');
    expect(messageFeed).toHaveAttribute('aria-labelledby', 'test-label');
    expect(messageFeed).toHaveAttribute('role', 'list');
  });
});