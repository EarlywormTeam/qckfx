/**
 * Hook for connecting WebSocket to Terminal interface using React Context
 * 
 * This hook connects the WebSocket functionality to the Terminal UI,
 * handling UI updates based on session events from the SocketConnectionManager.
 * 
 * IMPORTANT: This hook focuses on observing the connection state, NOT managing it.
 * Session joining/leaving is now handled by the SocketConnectionManager itself,
 * which maintains state independent of React's render cycle.
 */
import { useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { useTerminal } from '@/context/TerminalContext';
import { ConnectionStatus } from '@/types/api';
import { getSocketConnectionManager } from '@/utils/websocket';

/**
 * Hook that connects WebSocket events to Terminal UI
 * by observing external state rather than managing it directly
 * 
 * @param sessionId Optional session ID to join
 * @returns Object containing connection state and methods
 */
export function useTerminalWebSocket(sessionId?: string) {
  // Track if we've already tried to join this session to avoid duplicates
  const hasRequestedJoinRef = useRef<boolean>(false);
  const previousSessionIdRef = useRef<string | undefined>(undefined);
  
  // Get the singleton connection manager (outside React render cycle)
  const connectionManager = getSocketConnectionManager();
  
  // Use the base WebSocket hook for connection status
  const { 
    connectionStatus, 
    isConnected, 
    currentSessionId: contextSessionId
  } = useWebSocket();
  
  // Terminal UI methods for feedback
  const { addSystemMessage, addErrorMessage } = useTerminal();
  
  // Get session state information
  const sessionState = connectionManager.getSessionState();
  const hasJoined = sessionState.hasJoined && sessionState.currentSessionId === sessionId;
  
  // Request to join the session ONCE when the sessionId changes or 
  // when we first get connected
  useEffect(() => {
    // Skip if no session ID provided
    if (!sessionId) return;
    
    // Only process if we have a new session ID or we haven't tried to join yet
    const isNewSession = previousSessionIdRef.current !== sessionId;
    const shouldJoinSession = isNewSession || !hasRequestedJoinRef.current;
    
    if (shouldJoinSession) {
      console.log(`[useTerminalWebSocket] Requesting session join: ${sessionId} (connected: ${isConnected})`);
      
      // Use the connection manager directly to request a session join
      // It will handle the socket state properly
      connectionManager.joinSession(sessionId);
      
      // Mark that we've requested to join this session
      hasRequestedJoinRef.current = true;
      previousSessionIdRef.current = sessionId;
      
      // Don't add a system message here - we'll add it when the session is actually joined
    }
    
    // No cleanup function - session management is now handled externally
  }, [sessionId, isConnected]);
  
  // Listen for session events from the connection manager
  useEffect(() => {
    // Event handlers for session state changes
    const handleSessionChange = (newSessionId: string | null) => {
      // Only log session changes but don't show system messages
      if (newSessionId === sessionId) {
        console.log(`Connected to session: ${newSessionId}`);
      } else if (newSessionId === null && previousSessionIdRef.current === sessionId) {
        console.log('Disconnected from session');
      }
    };
    
    // Subscribe to events
    connectionManager.on('session_change', handleSessionChange);
    
    // Clean up subscriptions on unmount only
    return () => {
      connectionManager.off('session_change', handleSessionChange);
      
      // Important: Do NOT explicitly leave the session here!
      // The session should persist after component unmounts
      // Other components might still be using it
    };
  }, [sessionId, addSystemMessage]);
  
  // Track last notification time to prevent message spam
  const lastStatusChangeTime = useRef<Record<ConnectionStatus, number>>({
    [ConnectionStatus.CONNECTED]: 0,
    [ConnectionStatus.CONNECTING]: 0,
    [ConnectionStatus.DISCONNECTED]: 0,
    [ConnectionStatus.ERROR]: 0,
    [ConnectionStatus.RECONNECTING]: 0,
  });
  
  // Track previous connection status to detect changes
  const prevConnectionStatusRef = useRef<ConnectionStatus>(connectionStatus);
  
  // Monitor connection status changes with debounce to prevent message spam
  useEffect(() => {
    const now = Date.now();
    const minInterval = 2000; // 2 seconds between same status messages
    
    // Skip if status hasn't actually changed or if repeated too quickly
    if (prevConnectionStatusRef.current === connectionStatus && 
        now - lastStatusChangeTime.current[connectionStatus] < minInterval) {
      return;
    }
    
    // Update last notification time
    lastStatusChangeTime.current[connectionStatus] = now;
    
    // Handle connection status changes to show UI notifications
    switch (connectionStatus) {
      case ConnectionStatus.CONNECTED:
        // Only log connection status but don't show system message
        if (prevConnectionStatusRef.current !== ConnectionStatus.CONNECTED) {
          console.log('WebSocket connection established');
        }
        break;
        
      case ConnectionStatus.RECONNECTING:
        // Don't show reconnection messages in the UI
        // Just log to console instead
        console.log('Reconnecting WebSocket...');
        break;
        
      case ConnectionStatus.ERROR:
        addErrorMessage('WebSocket connection error');
        break;
        
      case ConnectionStatus.DISCONNECTED:
        // Only log disconnection if we were previously connected (not on initial mount)
        if (prevConnectionStatusRef.current === ConnectionStatus.CONNECTED) {
          console.log('WebSocket disconnected');
        }
        break;
    }
    
    // Update ref to track current status for next render
    prevConnectionStatusRef.current = connectionStatus;
  }, [connectionStatus, addSystemMessage, addErrorMessage]);
  
  // Function to manually connect to a session
  const connect = useCallback((sid: string) => {
    if (!sid) {
      addErrorMessage('Cannot connect: No session ID provided');
      return false;
    }
    
    const sessionState = connectionManager.getSessionState();
    
    // Already in this specific session
    if (sessionState.currentSessionId === sid && sessionState.hasJoined) {
      console.log(`[useTerminalWebSocket] Already connected to session ${sid}`);
      return false;
    }
    
    // Request the connection manager to join this session
    console.log(`[useTerminalWebSocket] Requesting connection to session ${sid}`);
    connectionManager.joinSession(sid);
    
    // Update our tracking
    previousSessionIdRef.current = sid;
    hasRequestedJoinRef.current = true;
    
    return true;
  }, [addErrorMessage]);
  
  // Function to disconnect from a session
  const disconnect = useCallback(() => {
    const sessionState = connectionManager.getSessionState();
    const sid = sessionState.currentSessionId;
    
    if (!sid) {
      addErrorMessage('Cannot disconnect: No active session');
      return false;
    }
    
    if (!sessionState.hasJoined) {
      console.log(`[useTerminalWebSocket] Not connected to any session`);
      return false;
    }
    
    console.log(`[useTerminalWebSocket] Requesting disconnection from session ${sid}`);
    connectionManager.leaveSession(sid);
    
    // Reset our tracking
    hasRequestedJoinRef.current = false;
    
    return true;
  }, [addErrorMessage]);
  
  // Return a stable interface with additional session state
  return {
    connectionStatus,
    isConnected,
    // Use the actual session state from the connection manager
    hasJoined,
    // Expose the current session ID from the session state
    sessionId: sessionState.currentSessionId,
    // Expose the context session ID for compatibility
    contextSessionId,
    // Provide stable methods for manually connecting/disconnecting
    connect,
    disconnect,
  };
}

export default useTerminalWebSocket;