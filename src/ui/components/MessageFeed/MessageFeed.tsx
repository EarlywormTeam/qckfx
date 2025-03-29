import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import Message from '@/components/Message';
import { TerminalMessage } from '@/types/terminal';
import { ToolExecution } from '@/hooks/useToolStream';
import ToolVisualization from '@/components/ToolVisualization/ToolVisualization';

// Define types for timeline items
type MessageTimelineItem = {
  id: string;
  timestamp: Date;
  type: 'message';
  message: TerminalMessage;
};

type ToolTimelineItem = {
  id: string;
  timestamp: Date;
  type: 'tool';
  tool: ToolExecution;
};

type TimelineItem = MessageTimelineItem | ToolTimelineItem;

export interface MessageFeedProps {
  messages: TerminalMessage[];
  toolExecutions?: Record<string, ToolExecution>;
  className?: string;
  autoScroll?: boolean;
  enableAnsiColors?: boolean;
  ariaLabelledBy?: string;
  showToolsInline?: boolean;
  isDarkTheme?: boolean; // Add terminal theme property
}

export function MessageFeed({
  messages,
  toolExecutions = {},
  className,
  autoScroll = true,
  enableAnsiColors = true,
  ariaLabelledBy,
  showToolsInline = true,
  isDarkTheme = false // Default to light theme
}: MessageFeedProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Combined auto-scroll effect for messages and tools
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      // Check if scrollIntoView is available (for JSDOM in tests)
      if (typeof messagesEndRef.current.scrollIntoView === 'function') {
        // Use 'auto' instead of 'smooth' for a snappier response
        messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
      }
    }
  }, [messages, toolExecutions, autoScroll]);

  // Process tools and messages together in a timeline
  const getTimelinedItems = () => {
    if (!showToolsInline || Object.keys(toolExecutions).length === 0) {
      return {
        messageItems: messages,
        toolItems: []
      };
    }

    // Convert tool executions to a format we can combine with messages
    const toolItems: Array<{id: string; timestamp: Date; tool: ToolExecution}> = Object.values(toolExecutions)
      // Sort by timestamp to ensure correct ordering
      .sort((a, b) => a.startTime - b.startTime)
      .map(tool => ({
        id: tool.id,
        timestamp: new Date(tool.startTime),
        tool
      }));

    // Track tool items count for internal use (may be used in the future)
    const _toolCount = toolItems.length;

    return {
      messageItems: messages, // No need to filter for 'tool' type as it's been removed
      toolItems
    };
  };

  const { messageItems, toolItems } = getTimelinedItems();

  // Render a timeline of messages and tools
  const renderTimelineItems = () => {
    if (messageItems.length === 0 && toolItems.length === 0) {
      return (
        <div 
          className="flex-1 flex items-center justify-center text-gray-500 min-h-[200px]"
          role="status"
          aria-live="polite"
        >
          <p>No messages yet</p>
        </div>
      );
    }

    // Create a merged timeline of messages and tools
    const allItems: TimelineItem[] = [
      ...messageItems.map(msg => ({ 
        id: msg.id, 
        timestamp: msg.timestamp, 
        type: 'message' as const, 
        message: msg 
      })),
      ...toolItems.map(tool => ({ 
        id: tool.id, 
        timestamp: tool.timestamp, 
        type: 'tool' as const, 
        tool: tool.tool 
      }))
    ];

    // Sort by timestamp
    allItems.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Render each item
    return allItems.map(item => {
      if (item.type === 'message') {
        const message = item.message;
        return (
          <div
            key={message.id}
            className={cn(
              message.type === 'user' && 'self-end max-w-[80%]',
              message.type === 'assistant' && 'self-start max-w-[80%]',
              (message.type === 'system' || message.type === 'error') && 'self-center max-w-full'
            )}
            data-testid={`message-${message.id}`}
            role="listitem"
            aria-label={`${message.type} message`}
          >
            <Message
              content={message.content}
              type={message.type}
              timestamp={message.timestamp}
              enableAnsiColors={enableAnsiColors && message.type === 'assistant'}
              ariaLabel={`${message.type === 'user' ? 'You' : message.type === 'assistant' ? 'Assistant' : message.type}: ${message.content}`}
            />
          </div>
        );
      } else {
        // Tool visualization - left-aligned and compact
        const tool = item.tool;
        return (
          <div
            key={tool.id}
            className="w-4/5 self-start mt-2 mb-2 ml-2" // Left-aligned, not centered
            data-testid={`tool-${tool.id}`}
            role="listitem"
            aria-label={`Tool execution: ${tool.toolName}`}
          >
            <ToolVisualization
              tool={tool}
              showExecutionTime={true}
              compact={true} // Always use compact view
              className="mx-0" // Remove horizontal margin
              isDarkTheme={isDarkTheme} // Pass terminal theme
            />
          </div>
        );
      }
    });
  };

  return (
    <div 
      className={cn(
        'flex flex-col flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-2',
        'min-h-[300px]', // Add minimum height to prevent layout shifts
        'max-h-[70vh]', // Add maximum height to constrain growth
        'h-full flex-grow', // Fill available space
        className
      )}
      data-testid="message-feed"
      aria-labelledby={ariaLabelledBy}
      role="list"
    >
      {renderTimelineItems()}
      <div ref={messagesEndRef} />
    </div>
  );
}

export default MessageFeed;