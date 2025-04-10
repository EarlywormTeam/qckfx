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
import { useToolVisualization } from '@/hooks/useToolVisualization';
import { useExecutionEnvironment } from '@/hooks/useExecutionEnvironment';
import { ConnectionStatus, WebSocketEvent } from '@/types/api';
import apiClient from '@/services/apiClient';
import { getWebSocketService } from '@/services/WebSocketService';
import { getSocketConnectionManager } from '@/utils/websocket';

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
  resolvePermission: (executionId: string, granted: boolean) => Promise<boolean>;
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
  const { isStreaming } = useStreamingMessages();
  
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
  
  // Create a new session with simplified logic
  const createSession = useCallback(async () => {
    try {
      // Update UI state
      setProcessing(true);
      
      console.log('[WebSocketTerminalContext] Requesting new session from API...');
      
      // Create session via API
      const response = await apiClient.startSession();
      console.log('[WebSocketTerminalContext] Session creation response:', response);
      
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
        
        // Store only in localStorage - simplifying storage
        localStorage.setItem('sessionId', newSessionId);
        console.log(`[WebSocketTerminalContext] Stored session ID in localStorage: ${newSessionId}`);
        
        // Update session state
        setSessionId(newSessionId);
        sessionIdRef.current = newSessionId;
        
        // Always use the connection manager directly to ensure the session is joined
        // This is more reliable than using the hook-based connectToSession
        const connectionManager = getSocketConnectionManager();
        connectionManager.joinSession(newSessionId);
        console.log(`[WebSocketTerminalContext] Requested connection join for session: ${newSessionId}`);
        
        // Update URL to include session ID without page reload
        window.history.pushState({}, '', `/sessions/${newSessionId}`);
        
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
  }, [addErrorMessage, setProcessing]);
  
  // Get the tool visualization hook for abort processing
  const toolVisualization = useToolVisualization();

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
      const activeTools = toolVisualization?.activeTools || [];
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
              timestamp: Date.now(),
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
  }, [addSystemMessage, addErrorMessage, setProcessing, toolVisualization]);
  
  // Create a session on mount if none provided - improved approach to prevent race conditions
  useEffect(() => {
    // Store the initialization state in a ref to prevent duplicate initializations
    if (isInitializedRef.current) {
      return;
    }
    
    // Immediately set initialization flag to prevent multiple session creations
    isInitializedRef.current = true;
    
    // Only create session if we don't have one
    if (!initialSessionId && !sessionId) {
      // Add retry logic with backoff
      let retryAttempt = 0;
      const maxRetries = 3;
      let isMounted = true; // Track component mount state
      
      const createNewSession = async () => {
        if (!isMounted) return;
        
        try {
          console.log('[WebSocketTerminalContext] Creating new session...');
          
          // Check localStorage for a recent valid session first
          const storedSessionId = localStorage.getItem('sessionId');
          if (storedSessionId) {
            console.log(`[WebSocketTerminalContext] Found stored session ID: ${storedSessionId}`);
            
            // Validate the session before using it
            try {
              const validationResponse = await apiClient.validateSession([storedSessionId]);
              if (validationResponse.success && validationResponse.data?.validSessionIds?.includes(storedSessionId)) {
                console.log(`[WebSocketTerminalContext] Stored session ID ${storedSessionId} is valid, reusing`);
                setSessionId(storedSessionId);
                sessionIdRef.current = storedSessionId;
                
                // Connect to the existing session
                const connectionManager = getSocketConnectionManager();
                connectionManager.joinSession(storedSessionId);
                return;
              }
            } catch (error) {
              console.warn(`[WebSocketTerminalContext] Failed to validate stored session ID: ${storedSessionId}`, error);
              // Continue with creating a new session
            }
          }
          
          // Create a new session if no valid stored session was found
          const newSessionId = await createSession();
          
          if (newSessionId && isMounted) {
            console.log(`[WebSocketTerminalContext] Successfully created session: ${newSessionId}`);
            
            // Store the sessionId in sessionStorage for permission handling
            sessionStorage.setItem('currentSessionId', newSessionId);
            console.log(`[WebSocketTerminalContext] Stored session ID in sessionStorage: ${newSessionId}`);
            
            // Only mark as initialized after successful session creation
            isInitializedRef.current = true;
          } else if (isMounted) {
            console.error('[WebSocketTerminalContext] No session ID returned');
            addErrorMessage('Failed to create session. Please refresh the page to try again.');
          }
        } catch (error) {
          if (isMounted) {
            console.error('[WebSocketTerminalContext] Session creation failed:', error);
            addErrorMessage(`Failed to create session: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      };
      
      // Create a new session immediately
      createNewSession();
      
      // Cleanup function
      return () => {
        isMounted = false;
      };
    } else {
      // Log we're using provided sessionId
      console.log(`[WebSocketTerminalContext] Using provided session ID: ${initialSessionId || sessionId}`);
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