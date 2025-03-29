/**
 * Utility functions for working with session state
 */
import { SessionState } from "../types/model";

/**
 * Check if a session has been aborted
 * This function is used to check if an operation should be stopped mid-execution.
 * Note: The abort flag is reset when a new user message is processed in AgentService.processQuery
 * 
 * @param sessionState The session state object to check
 * @returns Whether the session has been aborted
 */
export function isSessionAborted(sessionState: SessionState): boolean {
  return sessionState.__aborted === true;
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