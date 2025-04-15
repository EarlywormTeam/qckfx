/**
 * Utility functions for working with session state
 */
import { EventEmitter } from 'events';
import { v5 as uuidv5 } from 'uuid';
import { GitRepositoryInfo, DirtyRepositoryStatus } from '../types/session';

/**
 * Event emitter for agent-wide events
 * This provides a centralized event system that doesn't rely on object references
 */
export const AgentEvents = new EventEmitter();

/**
 * Event types for agent operations
 */
export enum AgentEventType {
  ABORT_SESSION = 'abort_session',
  ENVIRONMENT_STATUS_CHANGED = 'environment_status_changed',
  PROCESSING_COMPLETED = 'processing_completed'
}

/**
 * Environment status update event data
 */
export interface EnvironmentStatusEvent {
  environmentType: 'local' | 'docker' | 'e2b';
  status: 'initializing' | 'connecting' | 'connected' | 'disconnected' | 'error';
  isReady: boolean;
  error?: string;
}

/**
 * Check if a session has been aborted
 * This function is used to check if an operation should be stopped mid-execution.
 * 
 * @param sessionId The session ID to check
 * @returns Whether the session has been aborted
 */
export function isSessionAborted(sessionId: string): boolean {
  // Check for aborted events in the session registry - the single source of truth
  return abortedSessions.has(sessionId);
}

/**
 * Track aborted sessions with timestamps
 */
export const abortedSessions = new Map<string, number>();

/**
 * Mark a session as aborted
 * @param sessionId The session ID to abort
 */
export function setSessionAborted(sessionId: string): void {
  // Update the centralized abort registry with the current timestamp
  abortedSessions.set(sessionId, Date.now());
  
  // Emit abort event for all listeners
  AgentEvents.emit(AgentEventType.ABORT_SESSION, sessionId);
}

/**
 * Clear aborted status for a session
 * @param sessionId The session ID to clear
 */
export function clearSessionAborted(sessionId: string): void {
  abortedSessions.delete(sessionId);
}

/**
 * IMPORTANT: MESSAGE HISTORY RULES WHEN ABORTING OPERATIONS
 * 
 * When aborting an operation, we must ensure that the conversation history maintains proper structure.
 * The LLM APIs require specific formatting in the conversation history:
 * 
 * 1. Every `tool_use` message must be followed by a matching `tool_result` message with the same tool_use_id
 * 2. If a tool call is aborted, we still need to add a proper `tool_result` message
 *    with an "aborted: true" status to maintain the conversation flow
 * 
 * Failure to properly pair tool_use with tool_result will result in errors like:
 * "messages.X: `tool_use` ids were found without `tool_result` blocks immediately after"
 * 
 * When aborting operations, the AgentRunner handles this by:
 * - Adding appropriate tool_result messages to the conversation history
 * - Including an aborted:true flag in the result
 * - Maintaining the tool_use_id pairing between tool calls and results
 * 
 * This ensures we don't "brick" the agent even when operations are aborted mid-execution.
 */

/**
 * UUID Namespace for tool execution IDs
 * Used to generate consistent UUIDs from Anthropic tool use IDs
 */
export const TOOL_EXECUTION_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';

/**
 * Generate a stable execution ID from an Anthropic tool use ID
 * @param toolUseId The Anthropic-generated tool use ID
 * @returns A stable UUID v5 generated from the tool use ID
 */
export function generateExecutionId(toolUseId: string): string {
  return uuidv5(toolUseId, TOOL_EXECUTION_NAMESPACE);
}

/**
 * Format git repository information as a context prompt
 * @param gitInfo Git repository information
 * @returns Formatted string for use in system prompt
 */
export function formatGitInfoAsContextPrompt(gitInfo: GitRepositoryInfo | null): string | null {
  if (!gitInfo || !gitInfo.isGitRepository) {
    return null;
  }
  
  // Format the status information
  let statusInfo = '';
  if (gitInfo.status.type === 'clean') {
    statusInfo = '(clean)';
  } else {
    const dirtyStatus = gitInfo.status as DirtyRepositoryStatus;
    const parts = [];
    
    // Only include sections that have files
    if (dirtyStatus.modifiedFiles.length > 0) {
      parts.push(`Modified:\n  ${dirtyStatus.modifiedFiles.join('\n  ')}`);
    }
    
    if (dirtyStatus.stagedFiles.length > 0) {
      parts.push(`Staged:\n  ${dirtyStatus.stagedFiles.join('\n  ')}`);
    }
    
    if (dirtyStatus.untrackedFiles.length > 0) {
      parts.push(`Untracked:\n  ${dirtyStatus.untrackedFiles.join('\n  ')}`);
    }
    
    if (dirtyStatus.deletedFiles.length > 0) {
      parts.push(`Deleted:\n  ${dirtyStatus.deletedFiles.join('\n  ')}`);
    }
    
    statusInfo = parts.join('\n\n');
  }
  
  // Format the prompt as a context block
  const prompt = `<context name="gitStatus">This is the git status at the start of the conversation. Note that this status is a snapshot in time, and will not update during the conversation.
Current branch: ${gitInfo.currentBranch}

${gitInfo.defaultBranch ? `Default branch (you will usually use this for PRs): ${gitInfo.defaultBranch}` : ''}

Status:
${statusInfo}

${gitInfo.recentCommits.length > 0 ? `Recent commits:\n${gitInfo.recentCommits.join('\n')}` : ''}
</context>`;
  
  return prompt;
}