/**
 * Agent service for API integration
 */
import { EventEmitter } from 'events';
import { Anthropic } from '@anthropic-ai/sdk';
import crypto from 'crypto';
import {
  createAgent,
  createAnthropicProvider,
  createLogger,
  createPromptManager,
  LogLevel,
} from '../../index';
import { Agent } from '../../types/main';
import { 
  ToolPreviewState, 
  PreviewContentType, 
} from '../../types/preview';
import { ToolResultEntry } from '../../types';
import { 
  ToolExecutionState, 
  ToolExecutionStatus,
  ToolExecutionEvent,
  PermissionRequestState,
} from '../../types/tool-execution';

import { StoredMessage, RepositoryInfo, SessionListEntry } from '../../types/session';
import { createToolExecutionManager } from './tool-execution'; 
import { ToolExecutionManagerImpl } from './tool-execution/ToolExecutionManagerImpl';
import { createPreviewManager, PreviewManagerImpl } from './PreviewManagerImpl';
import { sessionManager } from './SessionManager';
import { previewService } from './preview/PreviewService';
import { ServerError, AgentBusyError } from '../utils/errors';
import { ExecutionAdapterFactoryOptions, createExecutionAdapter } from '../../utils/ExecutionAdapterFactory';
import { serverLogger } from '../logger';
import { SessionState } from '../../types/model';
import { setSessionAborted } from '../../utils/sessionUtils';
import { getSessionStatePersistence } from './sessionPersistenceProvider';
import { ExecutionAdapter } from '../../types/tool';

// Default system prompt for the agent
const DEFAULT_SYSTEM_PROMPT = "You are a precise, efficient AI assistant that helps users with software development tasks.";

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
  
  // Session events
  SESSION_SAVED = 'session:saved',
  SESSION_LOADED = 'session:loaded',
  SESSION_DELETED = 'session:deleted',
  
  // Message events (new)
  MESSAGE_RECEIVED = 'message:received',
  MESSAGE_UPDATED = 'message:updated',
  
  // Timeline events (new)
  TIMELINE_ITEM_UPDATED = 'timeline_item:updated'
}

/**
 * Configuration for the agent service
 */
export interface AgentServiceConfig {
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
 * Agent service for processing queries
 */
// Define interfaces for the tool state and events
interface ActiveTool {
  toolId: string;
  name: string;
  startTime: Date;
  paramSummary: string;
  executionId: string;
}

// Define type interfaces for the event data
interface ToolExecutionEventData {
  sessionId: string;
  tool: {
    id: string;
    name: string;
    executionId?: string;
  };
  args?: Record<string, unknown>;
  result?: unknown;
  paramSummary?: string;
  executionTime?: number;
  timestamp?: string;
  startTime?: string;
  abortTimestamp?: string;
  preview?: {
    contentType: string;
    briefContent: string;
    fullContent?: string;
    metadata?: Record<string, unknown>;
  };
  error?: {
    message: string;
    stack?: string;
  };
}

export class AgentService extends EventEmitter {
  private config: AgentServiceConfig;
  private activeProcessingSessionIds: Set<string> = new Set();
  private sessionFastEditMode: Map<string, boolean> = new Map();
  private activeTools: Map<string, ActiveTool[]> = new Map();
  private sessionExecutionAdapterTypes: Map<string, 'local' | 'docker' | 'e2b'> = new Map();
  private sessionE2BSandboxIds: Map<string, string> = new Map();
  private activeToolArgs = new Map<string, Record<string, unknown>>();
  
  // Add new properties for the managers
  private toolExecutionManager: ToolExecutionManagerImpl;
  private previewManager: PreviewManagerImpl;
  // Store reference to the current agent
  private agent: Agent | null = null;
  
  // Add new properties to store messages and repository info
  private sessionMessages: Map<string, StoredMessage[]> = new Map();
  private sessionRepositoryInfo: Map<string, RepositoryInfo> = new Map();
  
  // Instance properties to track Docker initialization status
  private dockerInitializing = false;
  private dockerInitializationPromise: Promise<ExecutionAdapter | null> | null = null;
  
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
    
    // Initialize the new managers
    this.previewManager = createPreviewManager() as PreviewManagerImpl;
    this.toolExecutionManager = createToolExecutionManager(this.previewManager) as ToolExecutionManagerImpl;
    
    // Set up event forwarding from the tool execution manager
    this.setupToolExecutionEventForwarding();
  }
  
  /**
   * Set up event forwarding from ToolExecutionManager to AgentService
   */
  private setupToolExecutionEventForwarding(): void {
    // Map ToolExecutionEvent to AgentServiceEvent
    const eventMap = {
      [ToolExecutionEvent.CREATED]: AgentServiceEvent.TOOL_EXECUTION_STARTED,
      [ToolExecutionEvent.UPDATED]: AgentServiceEvent.TOOL_EXECUTION,
      [ToolExecutionEvent.COMPLETED]: AgentServiceEvent.TOOL_EXECUTION_COMPLETED,
      [ToolExecutionEvent.ERROR]: AgentServiceEvent.TOOL_EXECUTION_ERROR,
      [ToolExecutionEvent.ABORTED]: AgentServiceEvent.TOOL_EXECUTION_ABORTED,
      [ToolExecutionEvent.PERMISSION_REQUESTED]: AgentServiceEvent.PERMISSION_REQUESTED,
      [ToolExecutionEvent.PERMISSION_RESOLVED]: AgentServiceEvent.PERMISSION_RESOLVED
      // PREVIEW_GENERATED events are handled separately, not forwarded to AgentService
    };
    
    // Forward each event type
    Object.entries(eventMap).forEach(([toolEvent, agentEvent]) => {
      this.toolExecutionManager.on(toolEvent as ToolExecutionEvent, (data) => {
        
        // For special events that have a specific structure, preserve the original structure
        // and don't transform the data - just forward it as-is
        if (toolEvent === ToolExecutionEvent.COMPLETED ||
            toolEvent === ToolExecutionEvent.PERMISSION_REQUESTED ||
            toolEvent === ToolExecutionEvent.PERMISSION_RESOLVED) {
            
          // Type the data properly based on the event type
          if (toolEvent === ToolExecutionEvent.COMPLETED) {
            console.log('🔴🔴🔴 ToolExecutionEvent.COMPLETED', JSON.stringify(data, null, 2));
            this.emit(agentEvent, data);
            
          } else if (toolEvent === ToolExecutionEvent.PERMISSION_REQUESTED || 
                     toolEvent === ToolExecutionEvent.PERMISSION_RESOLVED) {
            this.emit(agentEvent, data);
          }
          return; // Skip the standard emit flow
        }
        
        // For other events, transform the data to the expected format
        const transformedData = this.transformEventData(
          toolEvent as ToolExecutionEvent, 
          data as ToolExecutionState
        );
        
        this.emit(agentEvent, transformedData);
      });
    });
  }
  
  /**
   * Transform event data from ToolExecutionManager format to AgentService format
   */
  private transformEventData(
    toolEvent: ToolExecutionEvent, 
    data: ToolExecutionState
  ): ToolExecutionEventData | void {
    switch (toolEvent) {
      case ToolExecutionEvent.CREATED:
        return this.transformToolCreatedEvent(data);
        
      case ToolExecutionEvent.UPDATED:
        return this.transformToolUpdatedEvent(data);
        
      case ToolExecutionEvent.ERROR:
        return this.transformToolErrorEvent(data);
        
      case ToolExecutionEvent.ABORTED:
        return this.transformToolAbortedEvent(data);
    }
  }
  
  /**
   * Transform tool created event data
   */
  private transformToolCreatedEvent(execution: ToolExecutionState): ToolExecutionEventData {
    // Get preview if available
    const preview = this.previewManager.getPreviewForExecution(execution.id);
    
    // Also emit a timeline item event for this tool execution
    this.emit(AgentServiceEvent.TIMELINE_ITEM_UPDATED, {
      sessionId: execution.sessionId,
      item: {
        id: execution.id,
        type: 'tool_execution',
        sessionId: execution.sessionId,
        timestamp: execution.startTime,
        toolExecution: execution,
        preview: preview || undefined
      },
      isUpdate: false // This is a new item, not an update
    });
    
    return {
      sessionId: execution.sessionId,
      tool: {
        id: execution.toolId,
        name: execution.toolName,
        executionId: execution.id
      },
      args: execution.args,
      paramSummary: execution.summary || this.summarizeToolParameters(execution.toolId, execution.args),
      timestamp: execution.startTime
    };
  }
  
  /**
   * Transform tool updated event data
   */
  private transformToolUpdatedEvent(execution: ToolExecutionState): ToolExecutionEventData {
    // Get preview if available
    const preview = this.previewManager.getPreviewForExecution(execution.id);
    
    // Also emit a timeline item event for this tool execution update
    this.emit(AgentServiceEvent.TIMELINE_ITEM_UPDATED, {
      sessionId: execution.sessionId,
      item: {
        id: execution.id,
        type: 'tool_execution',
        sessionId: execution.sessionId,
        timestamp: execution.startTime,
        toolExecution: execution,
        preview: preview || undefined
      },
      isUpdate: true // This is an update to an existing item
    });
    
    return {
      sessionId: execution.sessionId,
      tool: {
        id: execution.toolId,
        name: execution.toolName,
        executionId: execution.id
      },
      result: execution.result,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Transform tool error event data
   */
  private transformToolErrorEvent(execution: ToolExecutionState): ToolExecutionEventData {
    // Check if a preview exists already
    let preview = this.previewManager.getPreviewForExecution(execution.id);
    
    // If no preview exists and we have an error, generate an error preview
    if (!preview && execution.error) {
      try {
        // Generate an error preview
        const errorPreview = previewService.generateErrorPreview(
          { id: execution.toolId, name: execution.toolName },
          {
            message: execution.error.message,
            name: 'Error',
            stack: execution.error.stack
          },
          { toolId: execution.toolId, args: execution.args }
        );
        
        // Extract fullContent if available for error preview
        let fullContent: string | undefined = undefined;
        
        // Error previews may have a fullContent field with the stack trace
        if (errorPreview.hasFullContent) {
          // Try to safely extract fullContent from any preview with it
          fullContent = (errorPreview as unknown as { fullContent?: string }).fullContent;
        }
        
        // Create and store the preview
        preview = this.previewManager.createPreview(
          execution.sessionId,
          execution.id,
          errorPreview.contentType,
          errorPreview.briefContent,
          fullContent,
          errorPreview.metadata
        );
        
        // Link the preview to the execution
        this.toolExecutionManager.associatePreview(execution.id, preview.id);
      } catch (error) {
        serverLogger.error(`Error generating error preview for ${execution.id}:`, error);
      }
    }
    
    // Also emit a timeline item event for this tool execution error
    this.emit(AgentServiceEvent.TIMELINE_ITEM_UPDATED, {
      sessionId: execution.sessionId,
      item: {
        id: execution.id,
        type: 'tool_execution',
        sessionId: execution.sessionId,
        timestamp: execution.startTime,
        toolExecution: execution,
        preview: preview || undefined
      },
      isUpdate: true // This is an update to an existing item
    });
    
    return {
      sessionId: execution.sessionId,
      tool: {
        id: execution.toolId,
        name: execution.toolName,
        executionId: execution.id
      },
      error: execution.error,
      paramSummary: execution.summary,
      timestamp: execution.endTime,
      startTime: execution.startTime,
      preview: preview ? this.convertPreviewStateToData(preview) : undefined
    };
  }
  
  /**
   * Transform tool aborted event data
   */
  private transformToolAbortedEvent(execution: ToolExecutionState): ToolExecutionEventData {
    // Check if a preview exists already
    let preview = this.previewManager.getPreviewForExecution(execution.id);
    
    // If no preview exists, generate an abort preview
    if (!preview) {
      try {
        // Create a simple text preview for aborted executions
        const abortMessage = `Tool execution was aborted at ${execution.endTime}`;
        
        // Create and store the preview
        preview = this.previewManager.createPreview(
          execution.sessionId,
          execution.id,
          PreviewContentType.TEXT, // Using proper enum value
          abortMessage,
          abortMessage, // same for brief and full
          { 
            toolId: execution.toolId,
            aborted: true,
            abortTime: execution.endTime
          }
        );
        
        // Link the preview to the execution
        this.toolExecutionManager.associatePreview(execution.id, preview.id);
      } catch (error) {
        serverLogger.error(`Error generating abort preview for ${execution.id}:`, error);
      }
    }
    
    // Also emit a timeline item event for this tool execution abort
    this.emit(AgentServiceEvent.TIMELINE_ITEM_UPDATED, {
      sessionId: execution.sessionId,
      item: {
        id: execution.id,
        type: 'tool_execution',
        sessionId: execution.sessionId,
        timestamp: execution.startTime,
        toolExecution: execution,
        preview: preview || undefined
      },
      isUpdate: true // This is an update to an existing item
    });
    
    return {
      sessionId: execution.sessionId,
      tool: {
        id: execution.toolId,
        name: execution.toolName,
        executionId: execution.id
      },
      timestamp: execution.endTime,
      startTime: execution.startTime,
      abortTimestamp: execution.endTime,
      preview: preview ? this.convertPreviewStateToData(preview) : undefined
    };
  }
  
  /**
   * Convert preview state to the format expected by clients
   */
  private convertPreviewStateToData(preview: ToolPreviewState): {
    contentType: string;
    briefContent: string;
    fullContent?: string;
    metadata?: Record<string, unknown>;
  } {
    return {
      contentType: preview.contentType,
      briefContent: preview.briefContent,
      fullContent: preview.fullContent,
      metadata: preview.metadata
    };
  }
  
  // When a tool execution starts (from the onToolExecutionStart callback)
  private handleToolExecutionStart(executionId: string, toolId: string, toolUseId: string, args: Record<string, unknown>, sessionId: string): void {
    const tool = this.agent?.toolRegistry.getTool(toolId);
    const toolName = tool?.name || toolId;
    
    serverLogger.debug(`Generated executionId for tool execution: ${executionId}`, {
      toolUseId,
      toolId,
      toolName
    });
    
    // Create a new tool execution in the manager with the generated executionId
    const execution = this.toolExecutionManager.createExecution(
      sessionId,
      toolId,
      toolName,
      executionId,
      toolUseId,
      args
    );
    
    // Add a summary for better display
    const paramSummary = this.summarizeToolParameters(toolId, args);
    this.toolExecutionManager.updateExecution(execution.id, { summary: paramSummary });
    
    // Start the execution
    this.toolExecutionManager.startExecution(execution.id);
    
    // For backward compatibility, still track in the activeTools map
    if (!this.activeTools.has(sessionId)) {
      this.activeTools.set(sessionId, []);
    }
    
    this.activeTools.get(sessionId)?.push({
      toolId,
      executionId: execution.id,
      name: toolName,
      startTime: new Date(execution.startTime),
      paramSummary
    });
    
    // Store the arguments for potential preview generation
    this.activeToolArgs.set(`${sessionId}:${toolId}`, args);
    this.activeToolArgs.set(`${sessionId}:${execution.id}`, args);
  }
  
  // When a tool execution completes
  private handleToolExecutionComplete(
    executionId: string,
    toolId: string, 
    args: Record<string, unknown>, 
    result: unknown, 
    executionTime: number, 
    sessionId: string
  ): void {

    // Find the execution ID for this tool
    const activeTools = this.activeTools.get(sessionId) || [];
    // const activeTool = activeTools.find(t => t.toolId === toolId);
    // const executionId = activeTool?.executionId;
    
    if (executionId) {
      // Complete the execution in the manager
      this.toolExecutionManager.completeExecution(executionId, result, executionTime);
      
      // Generate a preview for the completed tool
      // this.generateToolExecutionPreview(executionId, toolId, args, result);
      
      // Remove from active tools
      const newActiveTools = activeTools.filter(t => t.toolId !== toolId);
      this.activeTools.set(sessionId, newActiveTools);
      
      // // Clean up stored arguments
      this.activeToolArgs.delete(`${sessionId}:${toolId}`);
      this.activeToolArgs.delete(`${sessionId}:${executionId}`);
    } else {
      serverLogger.warn(`No execution ID found for completed tool: ${toolId}`);
    }
  }
  
  // When a tool execution fails
  private handleToolExecutionError(
    executionId: string,
    toolId: string, 
    args: Record<string, unknown>, 
    error: Error, 
    sessionId: string
  ): void {
    // Find the execution ID for this tool
    const activeTools = this.activeTools.get(sessionId) || [];
    // const activeTool = activeTools.find(t => t.toolId === toolId);
    // const executionId = activeTool?.executionId;
    
    if (executionId) {
      // Mark the execution as failed in the manager
      this.toolExecutionManager.failExecution(executionId, error);
      
      // Remove from active tools
      this.activeTools.set(
        sessionId, 
        activeTools.filter(t => t.toolId !== toolId)
      );
      
      // Clean up stored arguments
      this.activeToolArgs.delete(`${sessionId}:${toolId}`);
      this.activeToolArgs.delete(`${sessionId}:${executionId}`);
    } else {
      // If we don't have an execution ID, fall back to old behavior
      serverLogger.warn(`No execution ID found for failed tool: ${toolId}`);
    }
  }

  /**
   * Save complete agent session state including conversation history and agent service config
   */
  public async saveSessionState(
    sessionId: string, 
    sessionState: SessionState
  ): Promise<void> {
    try {
      // Get persistence service
      const persistence = getSessionStatePersistence();
      
      // Get saved session data or create new if it doesn't exist
      let sessionData = await persistence.getSessionDataWithoutEvents(sessionId);
      if (!sessionData) {
        // Create basic session data structure
        const session = sessionManager.getSession(sessionId);
        sessionData = {
          id: sessionId,
          name: `Session ${sessionId}`,
          createdAt: session.createdAt.toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [],
          toolExecutions: [],
          permissionRequests: [],
          previews: [],
          sessionState 
        };
      }
      
      if (sessionData) {
        // Update session state with conversation history included
        sessionData.sessionState = sessionState;
        sessionData.updatedAt = new Date().toISOString();
        
        // Save complete data
        await persistence.saveSession(sessionData);
      }
    } catch (error) {
      serverLogger.error(`Failed to save agent session state for session ${sessionId}:`, error);
    }
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

      // Create a prompt manager
      const promptManager = createPromptManager(DEFAULT_SYSTEM_PROMPT);

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
      
      // Get execution adapter to generate directory structure
      let executionAdapter: ExecutionAdapter;
      
      if (session.state.executionAdapter) {
        executionAdapter = session.state.executionAdapter;
      } else {
        const adapterResult = await createExecutionAdapter({
          type: executionAdapterType,
          logger
        });
        executionAdapter = adapterResult.adapter;
      }
      
      // Generate directory structure map only if it hasn't been generated for this session yet
      if (!session.state.directoryStructureGenerated) {
        try {
          // Get the current working directory using the execution adapter
          const cwdResult = await executionAdapter.executeCommand('pwd');
          const cwd = cwdResult.stdout.trim() || process.cwd();
          
          // Use the execution adapter's generateDirectoryMap method directly
          const directoryStructure = await executionAdapter.generateDirectoryMap(cwd, 10);
          
          // Set the directory structure in the prompt manager
          promptManager.setDirectoryStructurePrompt(directoryStructure);
          
          // Mark that we've generated directory structure for this session
          session.state.directoryStructureGenerated = true;
          
        } catch (error) {
          console.warn(`AgentService: Failed to generate directory structure map: ${(error as Error).message}`);
        }
      } else {
        console.log('AgentService: Using existing directory structure map for this session');
      }
      
      // Create the agent with permission handling based on configuration
      this.agent = createAgent({
        modelProvider,
        promptManager, // Pass the configured prompt manager
        environment,
        logger,
        permissionUIHandler: {
          requestPermission: (toolId: string, args: Record<string, unknown>): Promise<boolean> => {
            // If auto-approve mode is enabled and the tool is in the allowed list
            if (this.config.permissionMode === 'auto' && this.config.allowedTools?.includes(toolId)) {
              return Promise.resolve(true);
            }

            // For interactive mode, find or create a tool execution for this permission request
            let executionId: string;
            const activeTools = this.activeTools.get(sessionId) || [];
            const activeTool = activeTools.find(t => t.toolId === toolId);
            
            if (activeTool?.executionId) {
              executionId = activeTool.executionId;
            } else {
              serverLogger.warn(`No execution ID found for permission request: ${toolId}`);
              throw new Error(`No execution ID found for permission request: ${toolId}`);
            }
            
            // Create the permission request in the manager
            const permission = this.toolExecutionManager.requestPermission(executionId, args);
            if (!permission || !permission.id) {
              serverLogger.error(`Failed to create permission request for tool execution ${executionId}`);
              return Promise.resolve(false);
            }
            
            // Create a promise to wait for permission resolution
            return new Promise<boolean>(resolve => {
              // Store resolver in a closure that will be called when permission is resolved
              // We're now utilizing toolExecutionManager to track permissions
              // The UI will call resolvePermissionByExecutionId which will trigger resolution
              
              // Create a one-time event listener for permission resolution
              const onPermissionResolved = (data: unknown) => {
                // Type check and cast the data
                const typedData = data as { execution: ToolExecutionState; permissionRequest: PermissionRequestState };
                
                // Check if this is our permission request
                if (typedData.permissionRequest.id === permission.id) {
                  // Remove the listener to avoid memory leaks
                  const removeListener = this.toolExecutionManager.on(ToolExecutionEvent.PERMISSION_RESOLVED, onPermissionResolved);
                  removeListener();
                  
                  // Resolve with the permission status
                  resolve(typedData.permissionRequest.granted || false);
                }
              };
              
              // Add the listener
              this.toolExecutionManager.on(ToolExecutionEvent.PERMISSION_RESOLVED, onPermissionResolved);
            });
          },
        },
      });
      
      // Set Fast Edit Mode on the agent's permission manager based on this session's setting
      const isFastEditModeEnabled = this.getFastEditMode(sessionId);
      this.agent.permissionManager.setFastEditMode(isFastEditModeEnabled);
      
      // Store the execution adapter type in the session
      // Get the actual type from the agent's environment or default to 'local'
      const executionType = this.agent.environment?.type as 'local' | 'docker' | 'e2b' || 'docker';
      this.setExecutionAdapterType(sessionId, executionType);

      // Collect tool results
      const toolResults: ToolResultEntry[] = [];
      
      // Register callbacks for tool execution events using the new API
      const unregisterStart = this.agent.toolRegistry.onToolExecutionStart(
        (executionId: string, toolId: string, toolUseId: string, args: Record<string, unknown>, _context: unknown) => {
          this.handleToolExecutionStart(executionId, toolId, toolUseId, args, sessionId);
        }
      );
      
      const unregisterComplete = this.agent.toolRegistry.onToolExecutionComplete(
        (executionId: string, toolId: string, args: Record<string, unknown>, result: unknown, executionTime: number) => {
          this.handleToolExecutionComplete(executionId, toolId, args, result, executionTime, sessionId);
        }
      );
      
      const unregisterError = this.agent.toolRegistry.onToolExecutionError(
        (executionId: string, toolId: string, args: Record<string, unknown>, error: Error) => {
          this.handleToolExecutionError(executionId, toolId, args, error, sessionId);
        }
      );
      
      try {
        // Ensure the session state includes the sessionId for the new abort system
        session.state.id = sessionId;
        
        // Process the query with our registered callbacks
        const result = await this.agent.processQuery(query, session.state);
  
        if (result.error) {
          throw new ServerError(`Agent error: ${result.error}`);
        }
        
        // Capture any tool results from the response
        if (result.result && result.result.toolResults) {
          toolResults.push(...result.result.toolResults);
        }
        
        // Update the session with the new state, ensuring proper structure for conversationHistory
        const sessionState = result.sessionState;
        
        sessionManager.updateSession(sessionId, {
          state: sessionState,
          isProcessing: false,
        });

        this.emit(AgentServiceEvent.PROCESSING_COMPLETED, {
          sessionId,
          response: result.response,
        });
        
        // After successful query processing, save the complete session state
        await this.saveSessionState(sessionId, session.state);

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
   * Resolve a permission request by execution ID
   * 
   * This is the recommended approach that directly uses the execution ID.
   */
  public resolvePermissionByExecutionId(executionId: string, granted: boolean): boolean {
    try {
      // Directly use the ToolExecutionManager method to resolve permission
      const result = this.toolExecutionManager.resolvePermissionByExecutionId(executionId, granted);
      return !!result;
    } catch (error) {
      console.log(`Error resolving permission for execution: ${executionId}`, error);
      return false;
    }
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
    
    // Use the toolExecutionManager to get permission requests for the session
    const permissionRequests = this.toolExecutionManager
      .getExecutionsForSession(sessionId)
      .filter(e => e.status === ToolExecutionStatus.AWAITING_PERMISSION)
      .map(e => this.toolExecutionManager.getPermissionRequestForExecution(e.id))
      .filter(Boolean);
    
    for (const request of permissionRequests) {
      if (request) {
        requests.push({
          permissionId: request.id,
          toolId: request.toolId,
          args: request.args,
          timestamp: request.requestTime,
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
    
    // No need to ensure session state exists anymore for aborting
    
    // Use the centralized session abort mechanism
    // This will update the abort registry and emit events
    setSessionAborted(sessionId);

    serverLogger.info('abortOperation', { sessionId, session });
    
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
    
    // For each active tool, mark it as aborted in the manager and emit an event
    for (const tool of activeTools) {
      if (tool.executionId) {
        try {
          // Abort the execution in the manager (this will emit events)
          this.toolExecutionManager.abortExecution(tool.executionId);
          
          // Also remove it from the active tools list to prevent further processing
          this.activeTools.set(
            sessionId, 
            (this.activeTools.get(sessionId) || []).filter(t => t.executionId !== tool.executionId)
          );
          
          // Clean up stored arguments
          this.activeToolArgs.delete(`${sessionId}:${tool.toolId}`);
          this.activeToolArgs.delete(`${sessionId}:${tool.executionId}`);
        } catch (error) {
          // If abortion in manager fails, fall back to old behavior
          serverLogger.warn(`Failed to abort tool execution ${tool.executionId}: ${(error as Error).message}`);
        }
      } else {
         serverLogger.warn(`No execution ID found for aborted tool: ${tool.toolId}`);
      }
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
    return session.state.contextWindow?.getMessages() || [];
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
  public getActiveTools(sessionId: string): ActiveTool[] {
    return this.activeTools.get(sessionId) || [];
  }
  
  /**
   * Get the arguments for a tool execution
   */
  public getToolArgs(sessionId: string, toolId: string): Record<string, unknown> | undefined {
    return this.activeToolArgs.get(`${sessionId}:${toolId}`);
  }
  
  /**
   * Get all tool executions for a session
   */
  public getToolExecutionsForSession(sessionId: string): ToolExecutionState[] {
    return this.toolExecutionManager.getExecutionsForSession(sessionId);
  }
  
  /**
   * Get a specific tool execution
   */
  public getToolExecution(executionId: string): ToolExecutionState | undefined {
    return this.toolExecutionManager.getExecution(executionId);
  }
  
  /**
   * Get the tool execution manager instance
   */
  public getToolExecutionManager(): ToolExecutionManagerImpl {
    return this.toolExecutionManager;
  }
  
  /**
   * Get a preview for a specific tool execution
   */
  public getPreviewForExecution(executionId: string): ToolPreviewState | undefined {
    try {
      return this.previewManager.getPreviewForExecution(executionId);
    } catch (error) {
      serverLogger.error(`Error getting preview for execution ${executionId}:`, error);
      return undefined;
    }
  }
  
  /**
   * Get permission request for a specific tool execution
   */
  public getPermissionRequestForExecution(executionId: string): PermissionRequestState | null {
    const request = this.toolExecutionManager.getPermissionRequestForExecution(executionId);
    return request || null;
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
  
  /**
   * List all persisted sessions
   */
  public async listPersistedSessions(): Promise<SessionListEntry[]> {
    try {
      // Get the persistence service
      const persistence = getSessionStatePersistence();
      
      // Get session list entries
      const sessions = await persistence.listSessions();
      
      return sessions;
    } catch (error) {
      serverLogger.error('Failed to list persisted sessions:', error);
      return [];
    }
  }
  
  /**
   * Delete a persisted session
   */
  public async deletePersistedSession(sessionId: string): Promise<boolean> {
    try {
      // Get the persistence service
      const persistence = getSessionStatePersistence();
      
      // Delete the session data
      await persistence.deleteSessionData(sessionId);
      
      // Remove from memory caches
      this.sessionMessages.delete(sessionId);
      this.sessionRepositoryInfo.delete(sessionId);
      
      // Emit event
      this.emit(AgentServiceEvent.SESSION_DELETED, {
        sessionId,
        timestamp: new Date().toISOString()
      });
      
      return true;
    } catch (error) {
      serverLogger.error(`Failed to delete persisted session ${sessionId}:`, error);
      return false;
    }
  }
  
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
        if (!this.dockerInitializing) {
          this.dockerInitializing = true;
          
          // Start Docker initialization early for a smoother experience
          this.dockerInitializationPromise = new Promise((resolve) => {
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
                
                resolve(dockerAdapter as ExecutionAdapter);
              } catch (error) {
                serverLogger.warn(`Docker pre-initialization failed: ${(error as Error).message}`, 'system');
                resolve(null);
              }
            })();
          });
        }
      }
      
      // Wait for Docker initialization if it's in progress and we're using Docker
      let adapter: ExecutionAdapter | null;
      let type: 'local' | 'docker' | 'e2b' | undefined;
      if ((options.type === 'docker' || (options.type === undefined && !options.e2bSandboxId)) && 
          this.dockerInitializationPromise) {
        adapter = await this.dockerInitializationPromise;
        type = 'docker';
      } else {
        const res = await createExecutionAdapter(adapterOptions);
        adapter = res.adapter;
        type = res.type;
      }
      
      // Store the adapter type in the session
      this.setExecutionAdapterType(sessionId, type);
      
      // Update the session object with the execution adapter
      sessionManager.updateSession(sessionId, {
        state: {
          ...session.state,
          executionAdapter: adapter || undefined,
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
