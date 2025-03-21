import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import Message from '@/components/Message';
import { TerminalMessage } from '@/types/terminal';

export interface MessageFeedProps {
  messages: TerminalMessage[];
  className?: string;
  autoScroll?: boolean;
  enableAnsiColors?: boolean;
  ariaLabelledBy?: string;
}

export function MessageFeed({
  messages,
  className,
  autoScroll = true,
  enableAnsiColors = true,
  ariaLabelledBy
}: MessageFeedProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to the bottom when messages change
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      // Check if scrollIntoView is available (for JSDOM in tests)
      if (typeof messagesEndRef.current.scrollIntoView === 'function') {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, autoScroll]);

  return (
    <div 
      className={cn(
        'flex flex-col flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-2',
        className
      )}
      data-testid="message-feed"
      aria-labelledby={ariaLabelledBy}
      role="list"
    >
      {messages.length === 0 ? (
        <div 
          className="flex-1 flex items-center justify-center text-gray-500"
          role="status"
          aria-live="polite"
        >
          <p>No messages yet</p>
        </div>
      ) : (
        messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              message.type === 'user' && 'self-end max-w-[80%]',
              message.type === 'assistant' && 'self-start max-w-[80%]',
              (message.type === 'system' || message.type === 'error') && 'self-center max-w-full',
              message.type === 'tool' && 'self-start max-w-full'
            )}
            data-testid={`message-${message.id}`}
            role="listitem"
            aria-label={`${message.type} message`}
          >
            <Message
              content={message.content}
              type={message.type}
              timestamp={message.timestamp}
              enableAnsiColors={enableAnsiColors && (message.type === 'tool' || message.type === 'assistant')}
              // Message inherits styles from parent Terminal via CSS inheritance
              ariaLabel={`${message.type === 'user' ? 'You' : message.type === 'assistant' ? 'Assistant' : message.type}: ${message.content}`}
            />
          </div>
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

export default MessageFeed;