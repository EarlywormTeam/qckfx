import React, { useEffect, useState } from 'react';

interface AnnouncerProps {
  messages: { id: string; content: string; role?: string }[];
  assertive?: boolean;
}

/**
 * Component for announcing messages to screen readers
 */
export function Announcer({ messages, assertive = false }: AnnouncerProps) {
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  
  useEffect(() => {
    // Only announce if there are messages and the last message changed
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      
      // Check for abort-related system messages
      if (latestMessage.role === 'system' && 
          (latestMessage.content.includes('aborted') || 
           latestMessage.content.includes('Aborting'))) {
        setLastMessage('Operation aborted');
      }
      // Standard announcement behavior
      else if (latestMessage.content !== lastMessage) {
        setLastMessage(latestMessage.content);
      }
    }
  }, [messages, lastMessage]);
  
  if (!lastMessage) return null;
  
  return (
    <div 
      className="sr-only" 
      aria-live={assertive ? 'assertive' : 'polite'} 
      aria-atomic="true"
    >
      {lastMessage}
    </div>
  );
}

export default Announcer;