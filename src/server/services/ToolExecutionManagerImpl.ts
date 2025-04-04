import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  ToolExecutionManager,
  ToolExecutionState,
  ToolExecutionStatus,
  ToolExecutionEvent,
  PermissionRequestState
} from '../../types/tool-execution';
import { SessionStatePersistence } from './SessionStatePersistence';
import { getSessionStatePersistence } from './sessionPersistenceProvider';
import { serverLogger } from '../logger';

/**
 * Implementation of ToolExecutionManager that stores state in memory
 * with persistence support
 */
export class ToolExecutionManagerImpl implements ToolExecutionManager {
  private executions: Map<string, ToolExecutionState> = new Map();
  private sessionExecutions: Map<string, Set<string>> = new Map();
  private permissionRequests: Map<string, PermissionRequestState> = new Map();
  private sessionPermissions: Map<string, Set<string>> = new Map();
  private executionPermissions: Map<string, string> = new Map();
  private eventEmitter = new EventEmitter();
  
  // Add persistence support
  private persistence: SessionStatePersistence;
  
  /**
   * Create a new ToolExecutionManagerImpl
   * @param persistenceService Optional persistence service to use
   */
  constructor(persistenceService?: SessionStatePersistence) {
    // Use provided persistence service or get singleton instance
    this.persistence = persistenceService || getSessionStatePersistence();
  }

  /**
   * Create a new tool execution
   */
  createExecution(
    sessionId: string, 
    toolId: string, 
    toolName: string, 
    args: Record<string, unknown>
  ): ToolExecutionState {
    const id = uuidv4();
    const execution: ToolExecutionState = {
      id,
      sessionId,
      toolId,
      toolName,
      status: ToolExecutionStatus.PENDING,
      args,
      startTime: new Date().toISOString()
    };

    // Store the execution
    this.executions.set(id, execution);

    // Add to session executions
    if (!this.sessionExecutions.has(sessionId)) {
      this.sessionExecutions.set(sessionId, new Set());
    }
    this.sessionExecutions.get(sessionId)!.add(id);

    // Emit event
    this.emitEvent(ToolExecutionEvent.CREATED, execution);
    
    serverLogger.debug(`Created tool execution: ${id}`, {
      executionId: id,
      toolId,
      toolName,
      sessionId
    });

    return execution;
  }

  /**
   * Update an existing tool execution
   */
  updateExecution(executionId: string, updates: Partial<ToolExecutionState>): ToolExecutionState {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Tool execution not found: ${executionId}`);
    }

    // Create updated execution with immutable pattern
    const updatedExecution: ToolExecutionState = {
      ...execution,
      ...updates
    };

    // Store the updated execution
    this.executions.set(executionId, updatedExecution);

    // Emit event
    this.emitEvent(ToolExecutionEvent.UPDATED, updatedExecution);
    
    serverLogger.debug(`Updated tool execution: ${executionId}`, {
      executionId,
      updates: Object.keys(updates)
    });

    return updatedExecution;
  }

  /**
   * Update the status of a tool execution
   */
  updateStatus(executionId: string, status: ToolExecutionStatus): ToolExecutionState {
    return this.updateExecution(executionId, { status });
  }

  /**
   * Start a tool execution
   */
  startExecution(executionId: string): ToolExecutionState {
    return this.updateStatus(executionId, ToolExecutionStatus.RUNNING);
  }

  /**
   * Complete a tool execution with results
   */
  completeExecution(executionId: string, result: unknown, executionTime: number): ToolExecutionState {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Tool execution not found: ${executionId}`);
    }

    const endTime = new Date().toISOString();
    
    const updatedExecution = this.updateExecution(executionId, {
      status: ToolExecutionStatus.COMPLETED,
      result,
      endTime,
      executionTime
    });

    // Emit completion event
    this.emitEvent(ToolExecutionEvent.COMPLETED, updatedExecution);
    
    serverLogger.debug(`Completed tool execution: ${executionId}`, {
      executionId,
      executionTime
    });

    return updatedExecution;
  }

  /**
   * Mark a tool execution as failed
   */
  failExecution(executionId: string, error: Error): ToolExecutionState {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Tool execution not found: ${executionId}`);
    }

    const endTime = new Date().toISOString();
    const executionTime = new Date(endTime).getTime() - new Date(execution.startTime).getTime();
    
    const updatedExecution = this.updateExecution(executionId, {
      status: ToolExecutionStatus.ERROR,
      error: {
        message: error.message,
        stack: error.stack
      },
      endTime,
      executionTime
    });

    // Emit error event
    this.emitEvent(ToolExecutionEvent.ERROR, updatedExecution);
    
    serverLogger.debug(`Failed tool execution: ${executionId}`, {
      executionId,
      error: error.message
    });

    return updatedExecution;
  }

  /**
   * Abort a tool execution
   */
  abortExecution(executionId: string): ToolExecutionState {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Tool execution not found: ${executionId}`);
    }

    const endTime = new Date().toISOString();
    const executionTime = new Date(endTime).getTime() - new Date(execution.startTime).getTime();
    
    const updatedExecution = this.updateExecution(executionId, {
      status: ToolExecutionStatus.ABORTED,
      endTime,
      executionTime
    });

    // Emit abort event
    this.emitEvent(ToolExecutionEvent.ABORTED, updatedExecution);
    
    serverLogger.debug(`Aborted tool execution: ${executionId}`, {
      executionId
    });

    return updatedExecution;
  }

  /**
   * Create a permission request for a tool execution
   */
  requestPermission(executionId: string, args: Record<string, unknown>): PermissionRequestState {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Tool execution not found: ${executionId}`);
    }

    const id = uuidv4();
    const permissionRequest: PermissionRequestState = {
      id,
      sessionId: execution.sessionId,
      toolId: execution.toolId,
      toolName: execution.toolName,
      args,
      requestTime: new Date().toISOString(),
      executionId
    };

    // Store the permission request
    this.permissionRequests.set(id, permissionRequest);

    // Add to session permissions
    if (!this.sessionPermissions.has(execution.sessionId)) {
      this.sessionPermissions.set(execution.sessionId, new Set());
    }
    this.sessionPermissions.get(execution.sessionId)!.add(id);

    // Link execution to permission
    this.executionPermissions.set(executionId, id);

    // Update execution status
    this.updateStatus(executionId, ToolExecutionStatus.AWAITING_PERMISSION);

    // Emit event
    this.emitEvent(ToolExecutionEvent.PERMISSION_REQUESTED, {
      execution: this.executions.get(executionId),
      permission: permissionRequest
    });
    
    serverLogger.debug(`Created permission request: ${id} for execution: ${executionId}`, {
      permissionId: id,
      executionId,
      toolId: execution.toolId
    });

    return permissionRequest;
  }

  /**
   * Resolve a permission request by execution ID
   * 
   * This is the preferred way to resolve permissions as it allows the client to
   * simply pass the execution ID they already know, rather than requiring a lookup
   * of the permission ID first.
   */
  resolvePermissionByExecutionId(executionId: string, granted: boolean): PermissionRequestState {
    // Get the permission ID for this execution
    const permissionId = this.executionPermissions.get(executionId);
    if (!permissionId) {
      throw new Error(`No permission request found for execution: ${executionId}`);
    }
    
    // Resolve the permission using the existing method
    return this.resolvePermission(permissionId, granted);
  }

  /**
   * Resolve a permission request
   */
  resolvePermission(permissionId: string, granted: boolean): PermissionRequestState {
    const permissionRequest = this.permissionRequests.get(permissionId);
    if (!permissionRequest) {
      throw new Error(`Permission request not found: ${permissionId}`);
    }

    // Update the permission request
    const updatedPermission: PermissionRequestState = {
      ...permissionRequest,
      resolvedTime: new Date().toISOString(),
      granted
    };

    // Store the updated permission
    this.permissionRequests.set(permissionId, updatedPermission);

    const { executionId } = permissionRequest;

    // Update the execution status based on permission
    if (granted) {
      this.updateStatus(executionId, ToolExecutionStatus.RUNNING);
    } else {
      this.failExecution(executionId, new Error('Permission denied'));
    }

    // Emit event
    this.emitEvent(ToolExecutionEvent.PERMISSION_RESOLVED, {
      execution: this.executions.get(executionId),
      permission: updatedPermission
    });
    
    serverLogger.debug(`Resolved permission request: ${permissionId}`, {
      permissionId,
      executionId,
      granted
    });

    return updatedPermission;
  }

  /**
   * Associate a preview with a tool execution
   */
  associatePreview(executionId: string, previewId: string): ToolExecutionState {
    return this.updateExecution(executionId, { previewId });
  }

  /**
   * Get a tool execution by ID
   */
  getExecution(executionId: string): ToolExecutionState | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get all tool executions for a session
   */
  getExecutionsForSession(sessionId: string): ToolExecutionState[] {
    const executionIds = this.sessionExecutions.get(sessionId) || new Set();
    return Array.from(executionIds)
      .map(id => this.executions.get(id)!)
      .filter(Boolean);
  }

  /**
   * Get a permission request by ID
   */
  getPermissionRequest(permissionId: string): PermissionRequestState | undefined {
    return this.permissionRequests.get(permissionId);
  }

  /**
   * Get all permission requests for a session
   */
  getPermissionRequestsForSession(sessionId: string): PermissionRequestState[] {
    const permissionIds = this.sessionPermissions.get(sessionId) || new Set();
    return Array.from(permissionIds)
      .map(id => this.permissionRequests.get(id)!)
      .filter(Boolean);
  }

  /**
   * Get the permission request for a tool execution
   */
  getPermissionRequestForExecution(executionId: string): PermissionRequestState | undefined {
    const permissionId = this.executionPermissions.get(executionId);
    return permissionId ? this.permissionRequests.get(permissionId) : undefined;
  }

  /**
   * Register a listener for tool execution events
   */
  on(event: ToolExecutionEvent, listener: (data: unknown) => void): () => void {
    this.eventEmitter.on(event, listener);
    return () => this.eventEmitter.off(event, listener);
  }

  /**
   * Helper method to emit events
   */
  private emitEvent(event: ToolExecutionEvent, data: unknown): void {
    this.eventEmitter.emit(event, data);
  }
  
  /**
   * Save all data for a session
   * @param sessionId Session identifier
   */
  async saveSessionData(sessionId: string): Promise<void> {
    try {
      // Load existing session data or create a new one
      let sessionData = await this.persistence.loadSession(sessionId);
      const now = new Date().toISOString();
      
      if (!sessionData) {
        // Create a new session data object
        sessionData = {
          id: sessionId,
          name: `Session ${sessionId}`,
          createdAt: now,
          updatedAt: now,
          messages: [],
          toolExecutions: [],
          permissionRequests: [],
          previews: [],
          sessionState: { conversationHistory: [] }
        };
      }
      
      // Update the tool executions and permission requests
      sessionData.toolExecutions = this.getExecutionsForSession(sessionId);
      sessionData.permissionRequests = this.getPermissionRequestsForSession(sessionId);
      sessionData.updatedAt = now;
      
      // Save the updated session data
      await this.persistence.saveSession(sessionData);
      
      serverLogger.debug(`Saved tool execution data for session ${sessionId}`);
    } catch (error) {
      serverLogger.error(`Failed to save tool execution data for session ${sessionId}:`, error);
    }
  }
  
  /**
   * Load data for a session
   * @param sessionId Session identifier
   */
  async loadSessionData(sessionId: string): Promise<void> {
    try {
      // Load the session data
      const sessionData = await this.persistence.loadSession(sessionId);
      
      // Restore the data (only if we have a session)
      if (sessionData) {
        // First, clear any existing data for this session
        this.clearSessionData(sessionId);
        
        // Add executions to the manager
        for (const execution of sessionData.toolExecutions) {
          this.executions.set(execution.id, execution);
          
          // Add to session executions
          if (!this.sessionExecutions.has(sessionId)) {
            this.sessionExecutions.set(sessionId, new Set());
          }
          this.sessionExecutions.get(sessionId)!.add(execution.id);
        }
        
        // Add permissions to the manager
        for (const permission of sessionData.permissionRequests) {
          this.permissionRequests.set(permission.id, permission);
          
          // Add to session permissions
          if (!this.sessionPermissions.has(sessionId)) {
            this.sessionPermissions.set(sessionId, new Set());
          }
          this.sessionPermissions.get(sessionId)!.add(permission.id);
          
          // Link execution to permission if not resolved
          if (!permission.resolvedTime) {
            this.executionPermissions.set(permission.executionId, permission.id);
          }
        }
        
        serverLogger.info(`Loaded tool execution data for session ${sessionId}: ${sessionData.toolExecutions.length} executions, ${sessionData.permissionRequests.length} permissions`);
      }
    } catch (error) {
      serverLogger.error(`Failed to load tool execution data for session ${sessionId}:`, error);
    }
  }
  
  /**
   * Clear all data for a session
   * @param sessionId Session identifier
   */
  clearSessionData(sessionId: string): void {
    // Get all execution IDs for the session
    const executionIds = this.sessionExecutions.get(sessionId) || new Set();
    
    // Remove all executions
    for (const id of executionIds) {
      this.executions.delete(id);
    }
    
    // Remove session from executions map
    this.sessionExecutions.delete(sessionId);
    
    // Get all permission IDs for the session
    const permissionIds = this.sessionPermissions.get(sessionId) || new Set();
    
    // Remove all permissions
    for (const id of permissionIds) {
      // Get the permission to find the execution ID
      const permission = this.permissionRequests.get(id);
      if (permission) {
        // Remove the link from execution to permission
        this.executionPermissions.delete(permission.executionId);
      }
      
      this.permissionRequests.delete(id);
    }
    
    // Remove session from permissions map
    this.sessionPermissions.delete(sessionId);
  }
  
  /**
   * Delete session data from persistence
   * @param sessionId Session identifier
   */
  async deleteSessionData(sessionId: string): Promise<void> {
    try {
      // Clear in-memory data first
      this.clearSessionData(sessionId);
      
      // Then delete persisted data
      await this.persistence.deleteSession(sessionId);
      serverLogger.debug(`Deleted persisted tool execution data for session ${sessionId}`);
    } catch (error) {
      serverLogger.error(`Failed to delete persisted tool execution data for session ${sessionId}:`, error);
    }
  }

  /**
   * Clear all data (mainly for testing)
   */
  clear(): void {
    this.executions.clear();
    this.sessionExecutions.clear();
    this.permissionRequests.clear();
    this.sessionPermissions.clear();
    this.executionPermissions.clear();
  }
}

/**
 * Create a new ToolExecutionManager
 * @param persistenceService Optional persistence service to use
 * @returns New ToolExecutionManager instance
 */
export function createToolExecutionManager(
  persistenceService?: SessionStatePersistence
): ToolExecutionManager {
  return new ToolExecutionManagerImpl(persistenceService);
}