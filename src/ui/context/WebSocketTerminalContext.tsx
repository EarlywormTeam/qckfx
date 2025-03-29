/**
 * WebSocket-enhanced Terminal Context
 * 
 * Provides a context for Terminal UI components to interact with WebSocket
 * functionality, managing sessions and event subscriptions.
 */
import React, { createContext, useContext, ReactNode, useCallback, useEffect, useState, useRef } from 'react';
import { useTerminal } from './TerminalContext';
import { useTerminalWebSocket } from '@/hooks/useTerminalWebSocket';
import { useStreamingMessages } from '@/hooks/useStreamingMessages';
import { useTerminalCommands } from '@/hooks/useTerminalCommands';
import { usePermissionManager } from '@/hooks/usePermissionManager';
import { useToolStream } from '@/hooks/useToolStream';
import { ConnectionStatus, WebSocketEvent } from '@/types/api';
import apiClient from '@/services/apiClient';
import { getWebSocketService } from '@/services/WebSocketService';

interface WebSocketTerminalContextProps {
  // Connection state
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  
  // Session management
  sessionId: string | undefined;
  createSession: () => Promise<string | undefined>;
  
  // Command handling
  handleCommand: (command: string) => Promise<void>;
  
  // Processing state
  isProcessing: boolean;
  abortProcessing: () => Promise<void>;
  
  // Streaming state
  isStreaming: boolean;
  
  // Permission management
  hasPendingPermissions: boolean;
  resolvePermission: (permissionId: string, granted: boolean) => Promise<boolean>;
}

/**
 * Get tools that were aborted for a specific session
 * @param sessionId The session ID
 * @returns Set of aborted tool IDs
 */
export function getAbortedTools(sessionId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  
  const abortedToolsJson = window.sessionStorage.getItem(`aborted_tools_${sessionId}`);
  if (!abortedToolsJson) return new Set();
  
  try {
    const abortedTools = JSON.parse(abortedToolsJson) as string[];
    return new Set(abortedTools);
  } catch {
    return new Set();
  }
}

/**
 * Get abort timestamp for a specific session
 * @param sessionId The session ID
 * @returns Abort timestamp or null if not found
 */
export function getAbortTimestamp(sessionId: string): number | null {
  if (typeof window === 'undefined') return null;
  
  const timestamp = window.sessionStorage.getItem(`abort_timestamp_${sessionId}`);
  return timestamp ? parseInt(timestamp, 10) : null;
}

/**
 * Check if an event happened after the abort
 * @param sessionId The session ID
 * @param timestamp The event timestamp
 * @returns True if event happened after abort
 */
export function isEventAfterAbort(sessionId: string, timestamp: number): boolean {
  const abortTimestamp = getAbortTimestamp(sessionId);
  if (!abortTimestamp) return false;
  
  return timestamp > abortTimestamp;
}

// Create the context
const WebSocketTerminalContext = createContext<WebSocketTerminalContextProps | undefined>(undefined);

// Provider component
export function WebSocketTerminalProvider({
  children,
  initialSessionId
}: {
  children: ReactNode;
  initialSessionId?: string;
}) {
  // Get terminal methods from context
  const { addSystemMessage, addErrorMessage, setProcessing, isProcessing } = useTerminal();
  
  // Track session ID with both state and ref
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const sessionIdRef = useRef<string | undefined>(initialSessionId);
  
  // Track initialization state
  const isInitializedRef = useRef<boolean>(false);
  
  // Initialize WebSocket connection with the session ID
  // The hook does not reconnect unless the session ID actually changes
  const { 
    connectionStatus, 
    isConnected, 
    connect: connectToSession,
  } = useTerminalWebSocket(sessionId) || {};
  
  // Initialize feature hooks with stable sessionId reference
  const { isStreaming } = useStreamingMessages({ 
    sessionId: sessionIdRef.current 
  });
  
  const { handleCommand } = useTerminalCommands({ 
    sessionId: sessionIdRef.current 
  });
  
  const { hasPendingPermissions, resolvePermission } = usePermissionManager({ 
    sessionId: sessionIdRef.current 
  });
  
  // Update ref when state changes
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);
  
  // Create a new session with retry logic
  const createSession = useCallback(async () => {
    try {
      // Update UI state
      setProcessing(true);
      // Don't add a system message when creating a session - handled by the initialization process
      
      console.log('[WebSocketTerminalContext] Requesting new session from API...');
      
      // Create session via API
      const response = await apiClient.startSession();
      console.log('[WebSocketTerminalContext] Session creation response:', response);
      
      // Handle response - apiClient returns standardized format with data property
      // Check for sessionId in data (raw response) or in response.data (standardized wrapper)
      const sessionData = response.data || response;
      
      // Safely access sessionId with type checking
      const newSessionId = sessionData && 
        (typeof sessionData === 'object') && 
        'sessionId' in sessionData && 
        typeof sessionData.sessionId === 'string' 
          ? sessionData.sessionId 
          : undefined;
          
      if (newSessionId) {
        console.log(`[WebSocketTerminalContext] Session created successfully: ${newSessionId}`);
        
        // Store the sessionId in sessionStorage for permission handling
        sessionStorage.setItem('currentSessionId', newSessionId);
        console.log(`[WebSocketTerminalContext] Stored session ID in sessionStorage: ${newSessionId}`);
        
        // Update session state
        setSessionId(newSessionId);
        sessionIdRef.current = newSessionId;
        
        // Connect to the session via WebSocket if possible
        if (isConnected && typeof connectToSession === 'function') {
          connectToSession(newSessionId);
        }
        
        // Don't show session ID to users - they don't need to see this
        return newSessionId;
      } else {
        console.error('[WebSocketTerminalContext] Failed to create session - invalid response:', response);
        throw new Error('Failed to create session: Invalid response from server');
      }
    } catch (error) {
      console.error('[WebSocketTerminalContext] Failed to create session:', error);
      addErrorMessage(`Failed to create session: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    } finally {
      setProcessing(false);
    }
  }, [addSystemMessage, addErrorMessage, setProcessing, isConnected, connectToSession]);
  
  // Get the tool stream for abort processing
  const toolStream = useToolStream();

  // Abort processing with error handling
  const abortProcessing = useCallback(async () => {
    const currentSessionId = sessionIdRef.current;
    
    if (!currentSessionId) {
      addErrorMessage('No active session to abort');
      return;
    }
    
    try {
      // Immediately update UI state
      setProcessing(false);
      
      // Get active tools before aborting to find which ones to mark
      const activeTools = toolStream?.getActiveTools() || [];
      const activeToolIds = new Set(activeTools.map(tool => tool.id));
      
      // Create a timestamp for the abort event 
      const abortTimestamp = Date.now();
      
      // Use the API client to abort the operation
      const response = await apiClient.abortOperation(currentSessionId);
      
      if (response.success) {
        // Don't add system messages - rely on visual indicators only
        
        // Get the WebSocket service to emit events
        const wsService = getWebSocketService();
        
        // Add an aborted result to each active tool
        if (activeTools.length > 0) {
          for (const tool of activeTools) {
            // Create abort result event
            const abortEvent = {
              sessionId: currentSessionId,
              tool: {
                id: tool.id,
                name: tool.toolName || 'Tool',
              },
              result: {
                aborted: true,
                abortTimestamp
              },
              timestamp: new Date().toISOString(),
              executionTime: 0, // No execution time for aborted operations
            };
            
            // Emit tool completion with abort result
            wsService.emit(WebSocketEvent.TOOL_EXECUTION_COMPLETED, abortEvent);
          }
          
          // Remember aborted tools to ignore late events
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(
              `aborted_tools_${currentSessionId}`, 
              JSON.stringify([...activeToolIds])
            );
            
            window.sessionStorage.setItem(
              `abort_timestamp_${currentSessionId}`,
              abortTimestamp.toString()
            );
          }
        }
      } else {
        throw new Error(response.error?.message || 'Failed to abort operation');
      }
    } catch (error) {
      addErrorMessage(`Failed to abort: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [addSystemMessage, addErrorMessage, setProcessing, toolStream]);
  
  // Automatically create a session on mount if none provided, with retries
  useEffect(() => {
    // Only run initialization once
    if (isInitializedRef.current) {
      return;
    }
    
    // Only create session if we don't have one and we haven't tried yet
    if (!initialSessionId && !sessionId) {
      isInitializedRef.current = true;
      
      // Add retry logic with backoff
      let retryAttempt = 0;
      const maxRetries = 3;
      let isMounted = true; // Track component mount state
      
      const attemptSessionCreation = async () => {
        if (!isMounted) return;
        
        try {
          console.log(`[WebSocketTerminalContext] Attempting to create session (attempt ${retryAttempt + 1}/${maxRetries})`);
          const newSessionId = await createSession();
          
          if (newSessionId && isMounted) {
            console.log(`[WebSocketTerminalContext] Successfully created session: ${newSessionId}`);
            
            // Store the sessionId in sessionStorage for permission handling
            sessionStorage.setItem('currentSessionId', newSessionId);
            console.log(`[WebSocketTerminalContext] Stored session ID in sessionStorage: ${newSessionId}`);
          } else if (isMounted) {
            handleSessionCreationError(new Error("Failed to create session: No session ID returned"));
          }
        } catch (error) {
          if (isMounted) {
            handleSessionCreationError(error);
          }
        }
      };
      
      const handleSessionCreationError = (error: Error | unknown) => {
        console.error("[WebSocketTerminalContext] Session creation failed:", error);
        
        // Immediately show error message
        addErrorMessage(`Failed to create session: ${error instanceof Error ? error.message : String(error)}`);
        
        // Retry with exponential backoff
        if (retryAttempt < maxRetries && isMounted) {
          retryAttempt++;
          const backoffTime = 1000 * Math.pow(2, retryAttempt);
          console.log(`[WebSocketTerminalContext] Retrying in ${backoffTime}ms...`);
          
          setTimeout(attemptSessionCreation, backoffTime);
        } else if (isMounted) {
          addErrorMessage(`Failed to create session after ${maxRetries} attempts. Please try again later.`);
        }
      };
      
      // Start the first attempt
      attemptSessionCreation();
      
      // Cleanup function
      return () => {
        isMounted = false;
      };
    } else {
      // Mark as initialized if we already have a session
      isInitializedRef.current = true;
    }
  }, [initialSessionId, sessionId, createSession, addErrorMessage]);
  
  // Build the context value with stable references
  const value: WebSocketTerminalContextProps = {
    connectionStatus,
    isConnected,
    sessionId,
    createSession,
    handleCommand,
    isProcessing, // Use the value from TerminalContext
    abortProcessing,
    isStreaming,
    hasPendingPermissions,
    resolvePermission,
  };
  
  return (
    <WebSocketTerminalContext.Provider value={value}>
      {children}
    </WebSocketTerminalContext.Provider>
  );
}

// Custom hook to use the WebSocket terminal context
export function useWebSocketTerminal() {
  const context = useContext(WebSocketTerminalContext);
  
  if (context === undefined) {
    throw new Error('useWebSocketTerminal must be used within a WebSocketTerminalProvider');
  }
  
  return context;
}