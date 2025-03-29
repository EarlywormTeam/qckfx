import React from 'react';
import { useFastEditMode } from '../hooks';

interface FastEditModeIndicatorProps {
  sessionId?: string;
  className?: string;
}

/**
 * Component to display the Fast Edit Mode indicator
 * Positioned inside the terminal with status indication
 */
export const FastEditModeIndicator: React.FC<FastEditModeIndicatorProps> = ({ 
  sessionId,
  className,
}) => {
  const { fastEditMode } = useFastEditMode(sessionId);

  // Common styles for both enabled and disabled states
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '6px',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: 'normal',
    opacity: 0.8,
    textAlign: 'right',
  };

  // Triangle icon style
  const triangleStyle: React.CSSProperties = {
    width: '8px',
    height: '8px',
    clipPath: 'polygon(0 0, 0 100%, 100% 50%)',
    display: 'inline-block',
  };

  if (fastEditMode) {
    // Enabled state
    return (
      <div
        className={className}
        style={{
          ...containerStyle,
          color: '#00ff7f', // Bright green
        }}
        title="Fast Edit Mode is enabled. File operations will be auto-accepted."
      >
        <span>auto-accept edits on</span>
        <div style={{ display: 'flex', gap: '2px' }}>
          <span
            style={{
              ...triangleStyle,
              backgroundColor: '#00ff7f',
            }}
          />
          <span
            style={{
              ...triangleStyle,
              backgroundColor: '#00ff7f',
            }}
          />
        </div>
      </div>
    );
  } else {
    // Disabled state - show a hint
    return (
      <div
        className={className}
        style={{
          ...containerStyle,
          color: '#aaaaaa', // Gray
        }}
        title="Press Shift+Tab to enable auto-accept mode for file edits."
      >
        <span>press shift+tab for auto-accept mode</span>
      </div>
    );
  }
};

export default FastEditModeIndicator;