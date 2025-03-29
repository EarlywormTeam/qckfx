/**
 * Typing indicator component for real-time agent responses
 * 
 * This component is purely presentational and doesn't manage its own visibility.
 * The parent component controls when this is shown or hidden.
 */
import React from 'react';

/**
 * Props for the TypingIndicator component
 */
interface TypingIndicatorProps {
  className?: string;
}

/**
 * Animated typing indicator that shows when the agent is processing
 */
export function TypingIndicator({ 
  className = ''
}: TypingIndicatorProps) {
  return (
    <div 
      className={`flex items-center gap-1 px-2 py-1 ${className}`}
      aria-label="Agent is thinking"
      aria-live="polite"
      role="status"
      data-testid="typing-indicator"
      style={{
        fontSize: '11px',
        fontWeight: 'normal',
        opacity: 0.8,
        textAlign: 'left',
      }}
    >
      <div className="text-gray-500">Agent is thinking</div>
      <div className="flex gap-1">
        <div className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '200ms' }} />
        <div className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '400ms' }} />
      </div>
    </div>
  );
}

export default TypingIndicator;