/**
 * Agent service for API integration
 */
import { EventEmitter } from 'events';
import {
  createAgent,
  createAnthropicProvider,
  createLogger,
  LogLevel,
  LogCategory,
} from '../../index';
import { Session, sessionManager } from './SessionManager';
import { ServerError, ApiError, AgentBusyError } from '../utils/errors';
import { serverLogger } from '../logger';
import { ToolResultEntry } from '../../types';

/**
 * Events emitted by the agent service
 */
export enum AgentServiceEvent {
  PROCESSING_STARTED = 'processing:started',
  PROCESSING_COMPLETED = 'processing:completed',
  PROCESSING_ERROR = 'processing:error',
  PROCESSING_ABORTED = 'processing:aborted',
  TOOL_EXECUTION = 'tool:execution',
  PERMISSION_REQUESTED = 'permission:requested',
  PERMISSION_RESOLVED = 'permission:resolved',
}

/**
 * Configuration for the agent service
 */
export interface AgentServiceConfig {
  /** Anthropic API key */
  apiKey: string;
  /** Default model to use */
  defaultModel?: string;
  /** Permission mode */
  permissionMode?: 'auto' | 'interactive';
  /** Tools that are always allowed without permission */
  allowedTools?: string[];
}

/**
 * Permission request data 
 */
export interface PermissionRequest {
  /** Unique ID for this permission request */
  id: string;
  /** Session ID */
  sessionId: string;
  /** Tool ID */
  toolId: string;
  /** Tool arguments */
  args: Record<string, unknown>;
  /** Timestamp when the request was created */
  timestamp: Date;
  /** Resolver function to call when permission is granted or denied */
  resolver: (granted: boolean) => void;
}

/**
 * Agent service for processing queries
 */
export class AgentService extends EventEmitter {
  private config: AgentServiceConfig;
  private activeProcessingSessionIds: Set<string> = new Set();
  private permissionRequests: Map<string, PermissionRequest> = new Map();

  constructor(config: AgentServiceConfig) {
    super();
    this.config = {
      ...config,
      defaultModel: config.defaultModel || 'claude-3-7-sonnet-20250219',
      permissionMode: config.permissionMode || 'interactive',
      allowedTools: config.allowedTools || ['ReadTool', 'GlobTool', 'GrepTool', 'LSTool'],
    };
  }

  /**
   * Start a session with optional configuration
   */
  public startSession(config?: { model?: string }): Session {
    // Create a new session
    const session = sessionManager.createSession();
    return session;
  }

  /**
   * Process a query for a specific session
   */
  public async processQuery(
    sessionId: string,
    query: string
  ): Promise<{
    response: string;
    toolResults: ToolResultEntry[];
  }> {
    // Get the session
    const session = sessionManager.getSession(sessionId);

    // Check if the session is already processing
    if (session.isProcessing || this.activeProcessingSessionIds.has(sessionId)) {
      throw new AgentBusyError();
    }

    try {
      // Mark the session as processing
      this.activeProcessingSessionIds.add(sessionId);
      sessionManager.updateSession(sessionId, { isProcessing: true });

      // Emit event for processing started
      this.emit(AgentServiceEvent.PROCESSING_STARTED, { sessionId });

      // Create the model provider
      const modelProvider = createAnthropicProvider({
        apiKey: this.config.apiKey,
        model: this.config.defaultModel,
      });

      // Create a logger for this session
      const logger = createLogger({
        level: LogLevel.INFO,
        formatOptions: {
          showTimestamp: true,
          showPrefix: true,
          colors: true,
        },
      });

      // Create the agent with permission handling based on configuration
      const agent = createAgent({
        modelProvider,
        environment: { type: 'local' },
        logger,
        permissionUIHandler: {
          requestPermission: (toolId: string, args: Record<string, unknown>): Promise<boolean> => {
            // If auto-approve mode is enabled and the tool is in the allowed list
            if (this.config.permissionMode === 'auto' && this.config.allowedTools?.includes(toolId)) {
              return Promise.resolve(true);
            }

            // For interactive mode, create a permission request
            const permissionId = `${sessionId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            
            return new Promise<boolean>(resolve => {
              // Create the permission request
              const permissionRequest: PermissionRequest = {
                id: permissionId,
                sessionId,
                toolId,
                args,
                timestamp: new Date(),
                resolver: resolve,
              };
              
              // Store the permission request
              this.permissionRequests.set(permissionId, permissionRequest);
              
              // Emit permission requested event
              this.emit(AgentServiceEvent.PERMISSION_REQUESTED, {
                permissionId,
                sessionId,
                toolId,
                args,
                timestamp: permissionRequest.timestamp.toISOString(),
              });
              
              // Set a timeout to auto-reject after 2 minutes to prevent hanging
              setTimeout(() => {
                if (this.permissionRequests.has(permissionId)) {
                  serverLogger.info(`Permission request ${permissionId} timed out`);
                  this.resolvePermission(permissionId, false);
                }
              }, 2 * 60 * 1000);
            });
          },
        },
      });

      // Collect tool results
      const toolResults: ToolResultEntry[] = [];
      
      // Since the Agent doesn't have an EventEmitter interface, we can't directly attach event listeners
      // Instead, we'll collect tool results while processing

      // Process the query
      const result = await agent.processQuery(query, session.state);

      if (result.error) {
        throw new ServerError(`Agent error: ${result.error}`);
      }
      
      // Capture any tool results from the response
      if (result.result && result.result.toolResults) {
        toolResults.push(...result.result.toolResults);
      }

      // Update the session with the new state, ensuring proper structure for conversationHistory
      const sessionState = result.sessionState || {};
      const conversationHistory = Array.isArray(sessionState.conversationHistory) 
        ? sessionState.conversationHistory 
        : [];
      
      sessionManager.updateSession(sessionId, {
        state: { 
          conversationHistory,
          ...sessionState
        },
        isProcessing: false,
      });

      // Process completed successfully
      this.emit(AgentServiceEvent.PROCESSING_COMPLETED, {
        sessionId,
        response: result.response,
      });

      return {
        response: result.response || '',
        toolResults,
      };
    } catch (error) {
      // Update the session to mark it as not processing
      sessionManager.updateSession(sessionId, { isProcessing: false });

      // Emit error event
      this.emit(AgentServiceEvent.PROCESSING_ERROR, {
        sessionId,
        error,
      });

      throw error;
    } finally {
      // Remove the session from the active processing set
      this.activeProcessingSessionIds.delete(sessionId);
    }
  }

  /**
   * Resolve a permission request
   */
  public resolvePermission(permissionId: string, granted: boolean): boolean {
    const request = this.permissionRequests.get(permissionId);
    if (!request) {
      return false;
    }
    
    // Remove the request from the map
    this.permissionRequests.delete(permissionId);
    
    // Call the resolver
    request.resolver(granted);
    
    // Emit the permission resolved event
    this.emit(AgentServiceEvent.PERMISSION_RESOLVED, {
      permissionId,
      sessionId: request.sessionId,
      toolId: request.toolId,
      granted,
      timestamp: new Date().toISOString(),
    });
    
    return true;
  }

  /**
   * Get pending permission requests for a session
   */
  public getPermissionRequests(sessionId: string): Array<{
    permissionId: string;
    toolId: string;
    args: Record<string, unknown>;
    timestamp: string;
  }> {
    const requests: Array<{
      permissionId: string;
      toolId: string;
      args: Record<string, unknown>;
      timestamp: string;
    }> = [];
    
    for (const [id, request] of this.permissionRequests.entries()) {
      if (request.sessionId === sessionId) {
        requests.push({
          permissionId: id,
          toolId: request.toolId,
          args: request.args,
          timestamp: request.timestamp.toISOString(),
        });
      }
    }
    
    return requests;
  }

  /**
   * Abort a running operation for a session
   */
  public abortOperation(sessionId: string): boolean {
    // Get the session
    const session = sessionManager.getSession(sessionId);

    // Check if the session is processing
    if (!session.isProcessing && !this.activeProcessingSessionIds.has(sessionId)) {
      // Not processing, nothing to abort
      return false;
    }

    // Mark the session as not processing
    sessionManager.updateSession(sessionId, { isProcessing: false });
    this.activeProcessingSessionIds.delete(sessionId);

    // Emit abort event
    this.emit(AgentServiceEvent.PROCESSING_ABORTED, { sessionId });

    return true;
  }

  /**
   * Get the processing status of a session
   */
  public isProcessing(sessionId: string): boolean {
    // Get the session
    const session = sessionManager.getSession(sessionId);
    return session.isProcessing || this.activeProcessingSessionIds.has(sessionId);
  }

  /**
   * Get the history for a session
   */
  public getHistory(sessionId: string): any[] {
    // Get the session
    const session = sessionManager.getSession(sessionId);
    return session.state.conversationHistory || [];
  }
}

/**
 * Create and configure the agent service
 */
export function createAgentService(config: AgentServiceConfig): AgentService {
  return new AgentService(config);
}

/**
 * Singleton instance of the agent service
 */
let agentServiceInstance: AgentService | null = null;

/**
 * Get or initialize the agent service
 */
export function getAgentService(): AgentService {
  if (!agentServiceInstance) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new ServerError('ANTHROPIC_API_KEY environment variable is required');
    }

    agentServiceInstance = createAgentService({
      apiKey,
      defaultModel: process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-20250219',
      permissionMode: process.env.QCKFX_PERMISSION_MODE as 'auto' | 'interactive' || 'interactive',
      allowedTools: process.env.QCKFX_ALLOWED_TOOLS ? process.env.QCKFX_ALLOWED_TOOLS.split(',') : undefined,
    });
  }

  return agentServiceInstance;
}