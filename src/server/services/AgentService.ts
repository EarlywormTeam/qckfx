/**
 * Agent service for API integration
 */
import { EventEmitter } from 'events';
import {
  createAgent,
  createAnthropicProvider,
  createLogger,
  LogLevel,
} from '../../index';
import { Session, sessionManager } from './SessionManager';
import { ServerError, AgentBusyError } from '../utils/errors';
import { ToolResultEntry } from '../../types';
import { Anthropic } from '@anthropic-ai/sdk';
import { serverLogger } from '../logger';
import { ExecutionAdapterFactoryOptions, createExecutionAdapter } from '../../utils/ExecutionAdapterFactory';

/**
 * Events emitted by the agent service
 */
export enum AgentServiceEvent {
  // Process lifecycle events
  PROCESSING_STARTED = 'processing:started',
  PROCESSING_COMPLETED = 'processing:completed',
  PROCESSING_ERROR = 'processing:error',
  PROCESSING_ABORTED = 'processing:aborted',
  
  // Tool events
  TOOL_EXECUTION = 'tool:execution',
  TOOL_EXECUTION_STARTED = 'tool:execution:started',
  TOOL_EXECUTION_COMPLETED = 'tool:execution:completed',
  TOOL_EXECUTION_ERROR = 'tool:execution:error',
  TOOL_EXECUTION_ABORTED = 'tool:execution:aborted', // New event for aborted tools
  
  // Permission events
  PERMISSION_REQUESTED = 'permission:requested',
  PERMISSION_RESOLVED = 'permission:resolved',
  
  // Fast Edit Mode events
  FAST_EDIT_MODE_ENABLED = 'fast_edit_mode_enabled',
  FAST_EDIT_MODE_DISABLED = 'fast_edit_mode_disabled',
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
  /** Whether to enable prompt caching */
  cachingEnabled?: boolean;
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
  private sessionFastEditMode: Map<string, boolean> = new Map();
  private activeTools: Map<string, Array<{toolId: string; name: string; startTime: Date; paramSummary: string}>> = new Map();
  private sessionExecutionAdapterTypes: Map<string, 'local' | 'docker' | 'e2b'> = new Map();
  private sessionE2BSandboxIds: Map<string, string> = new Map();
  private activeToolArgs = new Map<string, Record<string, unknown>>();
  
  /**
   * Creates a concise summary of tool arguments for display
   * @private
   * @param toolId The ID of the tool being executed
   * @param args The arguments passed to the tool
   * @returns A string summary of the arguments
   */
  private summarizeToolParameters(toolId: string, args: Record<string, unknown>): string {
    // Special handling for file-related tools
    if ('file_path' in args || 'filepath' in args || 'path' in args) {
      const filePath = (args.file_path || args.filepath || args.path) as string;
      return filePath;
    }
    
    // Special handling for pattern-based tools
    if ('pattern' in args) {
      return `pattern: ${args.pattern}${args.include ? `, include: ${args.include}` : ''}`;
    }
    
    // Special handling for command execution
    if ('command' in args) {
      const cmd = args.command as string;
      return cmd.length > 40 ? `${cmd.substring(0, 40)}...` : cmd;
    }
    
    // Default case - basic serialization with length limit
    try {
      const str = JSON.stringify(args).replace(/[{}"]/g, '');
      return str.length > 50 ? `${str.substring(0, 50)}...` : str;
    } catch {
      // Return a fallback string if JSON serialization fails
      return 'Tool parameters';
    }
  }

  constructor(config: AgentServiceConfig) {
    super();
    this.config = {
      ...config,
      defaultModel: config.defaultModel || 'claude-3-7-sonnet-20250219',
      permissionMode: config.permissionMode || 'interactive',
      allowedTools: config.allowedTools || ['ReadTool', 'GlobTool', 'GrepTool', 'LSTool'],
      cachingEnabled: config.cachingEnabled !== undefined ? config.cachingEnabled : true,
    };
  }

  /**
   * Start a session with optional configuration
   */
  public async startSession(config?: { 
    model?: string; 
    executionAdapterType?: 'local' | 'docker' | 'e2b';
    e2bSandboxId?: string;
  }): Promise<Session> {
    // Create a new session
    const session = sessionManager.createSession();
    
    // Set execution adapter type if specified
    const adapterType = config?.executionAdapterType || 'docker';
    this.setExecutionAdapterType(session.id, adapterType);
    
    // If using e2b, also store the sandbox ID
    if (adapterType === 'e2b' && config?.e2bSandboxId) {
      this.setE2BSandboxId(session.id, config.e2bSandboxId);
    }
    
    // Start execution adapter creation immediately (fire and forget)
    serverLogger.info(`Starting ${adapterType} execution adapter initialization for session ${session.id}`);
    
    // Fire and forget - don't wait for container initialization
    this.createExecutionAdapterForSession(session.id, {
      type: adapterType,
      e2bSandboxId: config?.e2bSandboxId
    }).then(() => {
      serverLogger.info(`Execution adapter initialization completed for session ${session.id}`);
    }).catch(error => {
      serverLogger.error(`Failed to create execution adapter for session ${session.id}`, error);
    });
    
    // Return the session immediately without waiting for adapter initialization
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
      // Note: Abort status will be cleared in AgentRunner.processQuery when a new message is received
      this.activeProcessingSessionIds.add(sessionId);
      sessionManager.updateSession(sessionId, { isProcessing: true });

      // Emit event for processing started
      this.emit(AgentServiceEvent.PROCESSING_STARTED, { sessionId });

      // Create the model provider
      const modelProvider = createAnthropicProvider({
        apiKey: this.config.apiKey,
        model: this.config.defaultModel,
        cachingEnabled: this.config.cachingEnabled,
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

      // Get the execution adapter type and sandbox ID for this session
      const executionAdapterType = this.getExecutionAdapterType(sessionId) || 'local';
      const e2bSandboxId = this.getE2BSandboxId(sessionId);
      
      // Create appropriate environment config based on execution type
      let environment;
      
      if (executionAdapterType === 'e2b' && e2bSandboxId) {
        environment = { 
          type: 'e2b' as const, 
          sandboxId: e2bSandboxId 
        };
      } else if (executionAdapterType === 'docker') {
        environment = { type: 'docker' as const };
      } else {
        // Default to local
        environment = { type: 'local' as const };
      }
      
      // Create the agent with permission handling based on configuration
      const agent = createAgent({
        modelProvider,
        environment,
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
              
              // Get the tool name if available
              const tool = agent.toolRegistry.getTool(toolId);
              const toolName = tool?.name || toolId;
              
              // Emit permission requested event
              this.emit(AgentServiceEvent.PERMISSION_REQUESTED, {
                permissionId,
                sessionId,
                toolId,
                toolName,
                args,
                timestamp: permissionRequest.timestamp.toISOString(),
              });
              
              // No timeout - permission requests wait indefinitely for user action
            });
          },
        },
      });
      
      // Set Fast Edit Mode on the agent's permission manager based on this session's setting
      const isFastEditModeEnabled = this.getFastEditMode(sessionId);
      agent.permissionManager.setFastEditMode(isFastEditModeEnabled);
      
      // Store the execution adapter type in the session
      // Get the actual type from the agent's environment or default to 'local'
      const executionType = agent.environment?.type as 'local' | 'docker' | 'e2b' || 'docker';
      this.setExecutionAdapterType(sessionId, executionType);

      // Collect tool results
      const toolResults: ToolResultEntry[] = [];
      
      // Register callbacks for tool execution events using the new API
      const unregisterStart = agent.toolRegistry.onToolExecutionStart((toolId, args, _context) => {
        const tool = agent.toolRegistry.getTool(toolId);
        const toolName = tool?.name || toolId;
        const paramSummary = this.summarizeToolParameters(toolId, args);
        const startTime = new Date();
        
        // Store the arguments in the active tools map for later use by preview generators
        this.activeToolArgs.set(`${sessionId}:${toolId}`, args);
        
        // Track this tool as active
        if (!this.activeTools.has(sessionId)) {
          this.activeTools.set(sessionId, []);
        }
        
        this.activeTools.get(sessionId)?.push({
          toolId,
          name: toolName,
          startTime,
          paramSummary
        });
        
        this.emit(AgentServiceEvent.TOOL_EXECUTION_STARTED, {
          sessionId,
          tool: {
            id: toolId,
            name: toolName,
          },
          args,
          paramSummary,
          timestamp: startTime.toISOString(),
        });
      });
      
      const unregisterComplete = agent.toolRegistry.onToolExecutionComplete((toolId, args, result, executionTime) => {
        const tool = agent.toolRegistry.getTool(toolId);
        const toolName = tool?.name || toolId;
        const paramSummary = this.summarizeToolParameters(toolId, args);
        
        // Remove this tool from active tools
        if (this.activeTools.has(sessionId)) {
          const activeTools = this.activeTools.get(sessionId) || [];
          const updatedTools = activeTools.filter(t => t.toolId !== toolId);
          this.activeTools.set(sessionId, updatedTools);
        }
        
        // Clean up stored arguments after tool completion
        this.activeToolArgs.delete(`${sessionId}:${toolId}`);
        
        // Emit the standard tool execution event for consistency
        this.emit(AgentServiceEvent.TOOL_EXECUTION, { 
          sessionId,
          tool: {
            id: toolId,
            name: toolName,
          },
          result,
        });
        
        // Emit the new tool execution completed event
        this.emit(AgentServiceEvent.TOOL_EXECUTION_COMPLETED, {
          sessionId,
          tool: {
            id: toolId,
            name: toolName,
          },
          result,
          paramSummary,
          executionTime,
          timestamp: new Date().toISOString(),
        });
      });
      
      const unregisterError = agent.toolRegistry.onToolExecutionError((toolId, args, error) => {
        const tool = agent.toolRegistry.getTool(toolId);
        const toolName = tool?.name || toolId;
        const paramSummary = this.summarizeToolParameters(toolId, args);
        
        // Remove this tool from active tools
        if (this.activeTools.has(sessionId)) {
          const activeTools = this.activeTools.get(sessionId) || [];
          const updatedTools = activeTools.filter(t => t.toolId !== toolId);
          this.activeTools.set(sessionId, updatedTools);
        }
        
        // Clean up stored arguments on error too
        this.activeToolArgs.delete(`${sessionId}:${toolId}`);
        
        this.emit(AgentServiceEvent.TOOL_EXECUTION_ERROR, {
          sessionId,
          tool: {
            id: toolId,
            name: toolName,
          },
          error: {
            message: error.message,
            stack: error.stack,
          },
          paramSummary,
          timestamp: new Date().toISOString(),
        });
      });
      
      try {
        // Process the query with our registered callbacks
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
        // Clean up by unregistering callbacks
        unregisterStart();
        unregisterComplete();
        unregisterError();
        
        // Remove the session from the active processing set
        this.activeProcessingSessionIds.delete(sessionId);
      }
    } catch (error) {
      // Update the session to mark it as not processing
      sessionManager.updateSession(sessionId, { isProcessing: false });

      // Emit error event
      this.emit(AgentServiceEvent.PROCESSING_ERROR, {
        sessionId,
        error,
      });

      // Remove the session from the active processing set
      this.activeProcessingSessionIds.delete(sessionId);

      throw error;
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

    // Create abort timestamp
    const abortTimestamp = Date.now();
    
    // Directly modify the session state in place instead of creating a new object
    // This ensures all references to this session state object see the changes
    if (!session.state) {
      session.state = { conversationHistory: [] }; // Ensure state exists with required properties
    }
    
    // Set the abort flags directly on the existing state object
    session.state.__aborted = true;
    session.state.__abortTimestamp = abortTimestamp;
    
    // Get active tools for this session before we mark it as not processing
    const activeTools = this.getActiveTools(sessionId);
    
    // Update the session with modified state object
    // Since we modified the state object in place, any code holding a reference
    // to session.state will see these changes
    sessionManager.updateSession(sessionId, { 
      isProcessing: false,
      // We don't need to include state in the update since we modified it in place
    });
    
    // Also remove from active processing set
    this.activeProcessingSessionIds.delete(sessionId);

    // Emit abort event with timestamp
    this.emit(AgentServiceEvent.PROCESSING_ABORTED, { 
      sessionId,
      timestamp: new Date().toISOString(),
      abortTimestamp
    });
    
    // For each active tool, emit a tool abortion event
    for (const tool of activeTools) {
      this.emit(AgentServiceEvent.TOOL_EXECUTION_ABORTED, {
        sessionId,
        tool: {
          id: tool.toolId,
          name: tool.name,
        },
        timestamp: new Date().toISOString(),
        abortTimestamp
      });
    }

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
  public getHistory(sessionId: string): Anthropic.Messages.MessageParam[] {
    // Get the session
    const session = sessionManager.getSession(sessionId);
    return session.state.conversationHistory || [];
  }
  
  /**
   * Toggle fast edit mode for a session
   */
  public toggleFastEditMode(sessionId: string, enabled: boolean): boolean {
    try {
      // Verify the session exists (will throw if not found)
      sessionManager.getSession(sessionId);
      
      // Update the fast edit mode state
      this.sessionFastEditMode.set(sessionId, enabled);
      
      // Emit the appropriate event
      this.emit(
        enabled ? AgentServiceEvent.FAST_EDIT_MODE_ENABLED : AgentServiceEvent.FAST_EDIT_MODE_DISABLED,
        { sessionId, enabled }
      );
      
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get the fast edit mode state for a session
   */
  public getFastEditMode(sessionId: string): boolean {
    return this.sessionFastEditMode.get(sessionId) || false;
  }
  
  /**
   * Get active tools for a session
   */
  public getActiveTools(sessionId: string): Array<{toolId: string; name: string; startTime: Date; paramSummary: string}> {
    return this.activeTools.get(sessionId) || [];
  }
  
  /**
   * Get the arguments for a tool execution
   */
  public getToolArgs(sessionId: string, toolId: string): Record<string, unknown> | undefined {
    return this.activeToolArgs.get(`${sessionId}:${toolId}`);
  }
  
  /**
   * Set the execution adapter type for a session
   */
  public setExecutionAdapterType(sessionId: string, type: 'local' | 'docker' | 'e2b'): boolean {
    try {
      // Verify the session exists (will throw if not found)
      sessionManager.getSession(sessionId);
      
      // Update the session with the execution adapter type
      this.sessionExecutionAdapterTypes.set(sessionId, type);
      
      // Also update the session object
      sessionManager.updateSession(sessionId, { executionAdapterType: type });
      
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get the execution adapter type for a session
   */
  public getExecutionAdapterType(sessionId: string): 'local' | 'docker' | 'e2b' | undefined {
    try {
      // First check our map for the most current value
      const typeFromMap = this.sessionExecutionAdapterTypes.get(sessionId);
      if (typeFromMap) {
        return typeFromMap;
      }
      
      // Then try to get it from the session
      const session = sessionManager.getSession(sessionId);
      return session.state.executionAdapterType;
    } catch {
      return undefined;
    }
  }
  
  /**
   * Set the E2B sandbox ID for a session
   */
  public setE2BSandboxId(sessionId: string, sandboxId: string): boolean {
    try {
      // Verify the session exists
      sessionManager.getSession(sessionId);
      
      // Store the sandbox ID
      this.sessionE2BSandboxIds.set(sessionId, sandboxId);
      
      // Also update the session state
      const session = sessionManager.getSession(sessionId);
      sessionManager.updateSession(sessionId, {
        state: {
          ...session.state,
          e2bSandboxId: sandboxId
        }
      });
      
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get the E2B sandbox ID for a session
   */
  public getE2BSandboxId(sessionId: string): string | undefined {
    try {
      // First check the map
      const sandboxId = this.sessionE2BSandboxIds.get(sessionId);
      if (sandboxId) {
        return sandboxId;
      }
      
      // Then try to get it from the session
      const session = sessionManager.getSession(sessionId);
      return session.state.e2bSandboxId;
    } catch {
      return undefined;
    }
  }
  
  
  // Static cache to track Docker initialization status
  private static dockerInitializing = false;
  private static dockerInitializationPromise: Promise<boolean> | null = null;

  /**
   * Create an execution adapter for a session with the specified type
   */
  public async createExecutionAdapterForSession(
    sessionId: string, 
    options: { 
      type?: 'local' | 'docker' | 'e2b';
      e2bSandboxId?: string;
    } = {}
  ): Promise<void> {
    try {
      // Get the current session
      const session = sessionManager.getSession(sessionId);
      
      // Prepare options for execution adapter
      const adapterOptions: ExecutionAdapterFactoryOptions = {
        type: options.type,
        autoFallback: true,
        logger: serverLogger,
      };
      
      // Add E2B-specific options if needed
      if (options.type === 'e2b' && options.e2bSandboxId) {
        adapterOptions.e2b = {
          sandboxId: options.e2bSandboxId
        };
      }
      
      // For Docker, check if we need to initialize the container right away
      // This is a performance optimization for the first tool call
      if (options.type === 'docker' || (options.type === undefined && !options.e2bSandboxId)) {
        // Only pre-initialize if Docker initialization isn't already in progress
        if (!AgentService.dockerInitializing) {
          AgentService.dockerInitializing = true;
          
          // Start Docker initialization early for a smoother experience
          AgentService.dockerInitializationPromise = new Promise((resolve) => {
            // Use an immediately-invoked async function to avoid async executor
            (async () => {
              try {
                // Use the containerManager directly for faster initialization
                serverLogger.info(`Pre-initializing Docker container for session ${sessionId}...`, 'system');
                
                // Create temp adapter and initialize container (returns immediately with background task)
                const { adapter: dockerAdapter } = await createExecutionAdapter({
                  type: 'docker',
                  autoFallback: false,
                  logger: serverLogger
                });
                
                // Force container initialization to complete before first tool call
                if ('initializeContainer' in dockerAdapter) {
                  await (dockerAdapter as { initializeContainer: () => Promise<unknown> }).initializeContainer();
                  serverLogger.info('Docker container pre-initialization complete', 'system');
                }
                
                resolve(true);
              } catch (error) {
                serverLogger.warn(`Docker pre-initialization failed: ${(error as Error).message}`, 'system');
                resolve(false);
              }
            })();
          });
        }
      }
      
      // Wait for Docker initialization if it's in progress and we're using Docker
      if ((options.type === 'docker' || (options.type === undefined && !options.e2bSandboxId)) && 
          AgentService.dockerInitializationPromise) {
        await AgentService.dockerInitializationPromise;
      }
      
      // Create the execution adapter
      const { adapter, type } = await createExecutionAdapter(adapterOptions);
      
      // Store the adapter type in the session
      this.setExecutionAdapterType(sessionId, type);
      
      // Update the session object with the execution adapter
      sessionManager.updateSession(sessionId, {
        state: {
          ...session.state,
          executionAdapter: adapter,
          executionAdapterType: type
        }
      });
      
      serverLogger.info(`Created ${type} execution adapter for session ${sessionId}`);
    } catch (error) {
      serverLogger.error(`Failed to create execution adapter for session ${sessionId}`, error);
      
      // Log detailed error
      if (error instanceof Error) {
        serverLogger.error(`Detailed error creating execution adapter: ${error.message}`, error.stack);
      }
      
      // Fallback to local execution adapter
      serverLogger.warn(`Falling back to local execution for session ${sessionId}`);
      this.setExecutionAdapterType(sessionId, 'local');
    }
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
      cachingEnabled: process.env.QCKFX_DISABLE_CACHING ? false : true,
    });
  }

  return agentServiceInstance;
}