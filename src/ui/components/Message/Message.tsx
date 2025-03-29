import React from 'react';
import { cn } from '@/lib/utils';

export type MessageType = 'user' | 'assistant' | 'system' | 'error';

export interface MessageProps {
  content: string;
  type: MessageType;
  timestamp?: Date;
  className?: string;
  showTimestamp?: boolean;
  enableAnsiColors?: boolean;
  ariaLabel?: string;
  isStreaming?: boolean;
  streamingContent?: string;
}

// Simple ANSI escape code parser
// This is a basic implementation - for a full implementation, consider using a library
function parseAnsi(text: string): React.ReactNode {
  if (!text) return '';
  
  // Replace common ANSI color codes with spans
  // This is a simplified version that handles basic colors
  const parts: React.ReactNode[] = [];
  // eslint-disable-next-line no-control-regex
  const regex = /\x1b\[(\d+)m(.*?)(?=\x1b|\u0000|$)/g;
  let lastIndex = 0;
  let match;
  
  // Map ANSI color codes to Tailwind classes
  const colorMap: Record<string, string> = {
    '30': 'text-black',
    '31': 'text-red-500',
    '32': 'text-green-500',
    '33': 'text-yellow-500',
    '34': 'text-blue-500',
    '35': 'text-purple-500',
    '36': 'text-cyan-500',
    '37': 'text-white',
    '90': 'text-gray-500',
    '91': 'text-red-300',
    '92': 'text-green-300',
    '93': 'text-yellow-300',
    '94': 'text-blue-300',
    '95': 'text-purple-300',
    '96': 'text-cyan-300',
    '97': 'text-gray-100',
    '1': 'font-bold',
    '3': 'italic',
    '4': 'underline',
    '0': '', // Reset
  };
  
  while ((match = regex.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    
    const [_, code, content] = match;
    const className = colorMap[code] || '';
    
    if (code === '0') {
      // Reset - just add the content
      parts.push(content);
    } else {
      // Add styled content
      parts.push(
        <span key={match.index} className={className}>
          {content}
        </span>
      );
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add any remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts.length > 0 ? parts : text;
}

export function Message({
  content,
  type,
  timestamp,
  className,
  showTimestamp = true,
  enableAnsiColors = true,
  ariaLabel,
  isStreaming = false,
  streamingContent = '',
}: MessageProps) {
  // Process content for ANSI colors if enabled
  const processedContent = enableAnsiColors ? parseAnsi(content) : content;
  
  // Get CSS variables based on message type
  const getTypeStyles = () => {
    const baseStyles = {
      backgroundColor: '',
      color: '',
    };
    
    switch (type) {
      case 'user':
        return {
          ...baseStyles,
          backgroundColor: 'var(--terminal-user-msg-bg)',
          color: 'var(--terminal-user-msg-text)',
        };
      case 'assistant':
        return {
          ...baseStyles,
          backgroundColor: 'var(--terminal-assistant-msg-bg)',
          color: 'var(--terminal-assistant-msg-text)',
        };
      case 'system':
        return {
          ...baseStyles,
          backgroundColor: 'var(--terminal-system-msg-bg)',
          color: 'var(--terminal-system-msg-text)',
          fontStyle: 'italic',
          fontSize: '0.85em', // Slightly smaller than normal text and will scale with parent
        };
      case 'error':
        return {
          ...baseStyles,
          backgroundColor: 'var(--terminal-error-msg-bg)',
          color: 'var(--terminal-error-msg-text)',
          fontSize: '0.85em', // Match system messages size
        };
      default:
        return baseStyles;
    }
  };
  
  return (
    <div
      className={cn(
        'px-3 py-2 rounded',
        'terminal-message-animation',
        className,
        isStreaming && 'message-streaming'
      )}
      style={getTypeStyles()}
      data-testid="message"
      data-message-type={type}
      data-streaming={isStreaming ? 'true' : 'false'}
      role={type === 'error' ? 'alert' : 'log'}
      aria-label={ariaLabel}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
    >
      {isStreaming ? (
        <div className="whitespace-pre-wrap break-words">
          {streamingContent}
          <span className="animate-pulse cursor">|</span>
        </div>
      ) : (
        <div className="whitespace-pre-wrap break-words">{processedContent}</div>
      )}
      
      {showTimestamp && timestamp && !isStreaming && (
        <div 
          className="mt-1"
          style={{ 
            opacity: 0.7,
            fontSize: '0.75em' // Make timestamp scale with parent message size
          }}
          aria-hidden="true"
        >
          {timestamp.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

export default Message;