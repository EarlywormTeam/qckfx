/**
 * WebSocket-enhanced Terminal Component
 */
import React, { useState, useEffect } from 'react';
import Terminal from './Terminal/Terminal';
// ConnectionIndicator is included in Terminal
import { ConnectionIndicator as _ConnectionIndicator } from './ConnectionIndicator';
// TypingIndicator is included in Terminal
import { TypingIndicator as _TypingIndicator } from './TypingIndicator';
import { useWebSocketTerminal } from '@/context/WebSocketTerminalContext';
import { useTerminal } from '@/context/TerminalContext';
import { usePermissionKeyboardHandler } from '@/hooks/usePermissionKeyboardHandler';
import { useAbortShortcuts } from '@/hooks/useAbortShortcuts';

interface WebSocketTerminalProps {
  className?: string;
  fullScreen?: boolean;
  autoConnect?: boolean;
  showConnectionStatus?: boolean;
  showTypingIndicator?: boolean;
}

/**
 * WebSocket-enhanced Terminal Component with real-time updates
 */
export function WebSocketTerminal({
  className,
  fullScreen = false,
  autoConnect = true,
  showConnectionStatus = true,
  showTypingIndicator = true,
}: WebSocketTerminalProps) {
  const {
    handleCommand,
    connectionStatus,
    isConnected,
    isProcessing,
    isStreaming,
    abortProcessing,
    sessionId
  } = useWebSocketTerminal();
  
  // Get both state and the typing indicator state directly from TerminalContext
  const { state, clearMessages } = useTerminal();
  const [hasConnected, setHasConnected] = useState(false);
  
  // Add keyboard handler for permission requests
  usePermissionKeyboardHandler({ sessionId });
  
  // Add keyboard handler for abort operations
  useAbortShortcuts(isConnected);
  
  // Check if we've ever connected and store the sessionId
  useEffect(() => {
    if (isConnected && !hasConnected) {
      setHasConnected(true);
      
      // Store the sessionId in sessionStorage for use by other components
      if (sessionId) {
        sessionStorage.setItem('currentSessionId', sessionId);
        console.log('Session ID stored in sessionStorage:', sessionId);
      }
    }
  }, [isConnected, hasConnected, sessionId]);
  
  // Auto-connect if enabled
  useEffect(() => {
    if (autoConnect && !hasConnected) {
      // This will happen automatically via the WebSocketTerminalProvider
    }
  }, [autoConnect, hasConnected]);
  
  return (
    <div className="relative w-full max-w-full flex flex-col" style={{ height: "calc(100% - 20px)" }} data-testid="websocket-terminal">
      {/* Connection indicator now integrated directly in the Terminal title bar */}
      
      <Terminal
        className={className}
        messages={state.messages}
        onCommand={handleCommand}
        inputDisabled={!isConnected && hasConnected}
        fullScreen={fullScreen}
        onClear={clearMessages}
        sessionId={sessionId}
        showConnectionIndicator={showConnectionStatus}
        showTypingIndicator={showTypingIndicator}
        showToolVisualizations={true}
        connectionStatus={connectionStatus}
      />
      
      {/* Typing indicator is now handled inside the Terminal component */}
      
      {/* Permissions are now handled through the ToolVisualization component */}
      
      {/* Abort button is now integrated into the Terminal component */}
    </div>
  );
}

export default WebSocketTerminal;