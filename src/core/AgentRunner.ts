/**
 * AgentRunner - Orchestrates the entire agent process
 */

import { 
  AgentRunner, 
  AgentRunnerConfig, 
  ConversationResult, 
  ProcessQueryResult, 
  ToolResultEntry 
} from '../types/agent';
import { ToolCall, ConversationMessage, SessionState } from '../types/model';
import { LogCategory, createLogger, LogLevel } from '../utils/logger';

import { isSessionAborted } from '../utils/sessionUtils';

/**
 * Creates a standard response for aborted operations
 * @param toolResults Any tool results collected before abort
 * @param iterations Number of iterations completed before abort
 * @param sessionState The session state
 * @returns A standardized abort result
 */
function createAbortResponse(toolResults: ToolResultEntry[], iterations: number, sessionState: SessionState): ProcessQueryResult {
  return {
    result: {
      toolResults,
      iterations
    },
    response: "Operation aborted by user",
    sessionState,
    done: true,
    aborted: true
  };
}

/**
 * Helper function to create a concise summary of tool arguments
 * @param args The arguments to summarize
 * @returns A concise string representation of the arguments
 */
function summarizeArgs(args: Record<string, unknown>): string {
  // Handle file paths specially
  if (args.file_path || args.filepath || args.path) {
    const filePath = (args.file_path || args.filepath || args.path) as string;
    const otherArgs = { ...args };
    delete otherArgs.file_path;
    delete otherArgs.filepath;
    delete otherArgs.path;
    
    if (Object.keys(otherArgs).length > 0) {
      return `${filePath} + ${Object.keys(otherArgs).length} more args`;
    } else {
      return filePath;
    }
  }
  
  // For pattern-based tools
  if (args.pattern) {
    return `pattern: ${args.pattern}${args.include ? `, include: ${args.include}` : ''}`;
  }
  
  // For command execution
  if (args.command) {
    const cmd = args.command as string;
    return cmd.length > 30 ? `${cmd.substring(0, 30)}...` : cmd;
  }
  
  // Default case - list all args with their types
  return Object.entries(args)
    .map(([key, val]) => {
      if (typeof val === 'string') {
        if (val.length > 20) {
          return `${key}: "${val.substring(0, 20)}..."`;
        }
        return `${key}: "${val}"`;
      } else if (Array.isArray(val)) {
        return `${key}: [${val.length} items]`;
      } else if (typeof val === 'object' && val !== null) {
        return `${key}: {object}`;
      }
      return `${key}: ${val}`;
    })
    .join(', ');
}

/**
 * Creates an agent runner to orchestrate the agent process
 * @param config - Configuration options
 * @returns The agent runner interface
 */
export const createAgentRunner = (config: AgentRunnerConfig): AgentRunner => {
  // Validate required dependencies
  if (!config.modelClient) throw new Error('AgentRunner requires a modelClient');
  if (!config.toolRegistry) throw new Error('AgentRunner requires a toolRegistry');
  if (!config.permissionManager) throw new Error('AgentRunner requires a permissionManager');
  if (!config.executionAdapter) throw new Error('AgentRunner requires an executionAdapter');
  // Dependencies
  const modelClient = config.modelClient;
  const toolRegistry = config.toolRegistry;
  const permissionManager = config.permissionManager;
  const executionAdapter = config.executionAdapter;
  const logger = config.logger || createLogger({
    level: LogLevel.INFO,
    prefix: 'AgentRunner'
  });
  
  // Return the public interface
  return {
    /**
     * Process a user query
     * @param query - The user's query
     * @param sessionState - Current session state 
     * @returns The result of processing the query
     * 
     * NOTE: The query is always appended to the end of the conversation 
     * history before this call is made.
     */
    async processQuery(query: string, sessionState: SessionState): Promise<ProcessQueryResult> {
      try {
        // Initialize tracking variables
        let currentQuery = query;
        const toolResults: ToolResultEntry[] = [];
        let finalResponse = null;
        // When danger mode is enabled, use a higher iterations limit
        const maxIterations = permissionManager.isDangerModeEnabled() ? 40 : 15;
        let iterations = 0;
        
        // Initialize conversation history if it doesn't exist
        if (!sessionState.conversationHistory) {
          sessionState.conversationHistory = [];
        }
        
        // Always add the user query to conversation history after an abort
        // or if it's the first message or if the last message wasn't from the user
        if (sessionState.__aborted === true || 
            sessionState.conversationHistory.length === 0 || 
            sessionState.conversationHistory[sessionState.conversationHistory.length - 1].role !== 'user') {
          
          // Reset abort status if it was previously set
          if (sessionState.__aborted === true) {
            logger.info("Clearing abort status as new user message received", LogCategory.SYSTEM);
            sessionState.__aborted = false;
            delete sessionState.__abortTimestamp;
          }
          
          sessionState.conversationHistory.push({
            role: 'user',
            content: [{ type: 'text', text: query }]
          });
        }
        
        // Create the context for tool execution
        const context = {
          permissionManager,
          sessionState,
          logger,
          toolRegistry,
          modelClient,
          executionAdapter
        };
        
        // Loop until we get a final response or reach max iterations
        while (iterations < maxIterations) {
          // Add this check at the beginning of each iteration
          if (isSessionAborted(sessionState)) {
            logger.info("Operation aborted - stopping processing", LogCategory.SYSTEM);
            return createAbortResponse(toolResults, iterations, sessionState);
          }
          
          iterations++;
          logger.debug(`Iteration ${iterations}/${maxIterations}`, LogCategory.SYSTEM);
          
          try {
            // 1. Ask the model what to do next
            logger.debug('Getting tool call from model', LogCategory.MODEL);
            
            const toolCallChat = await modelClient.getToolCall(
              currentQuery, 
              toolRegistry.getToolDescriptions(), 
              sessionState
            );
            
            // Check if the operation was aborted during the model call
            if (toolCallChat.aborted || isSessionAborted(sessionState)) {
              logger.info("Operation aborted during or after LLM response - stopping processing", LogCategory.SYSTEM);
              
              // Add an aborted tool result to the conversation if a tool was chosen but not executed
              if (toolCallChat.toolChosen && toolCallChat.toolCall) {
                const toolCall = toolCallChat.toolCall as ToolCall;
                
                // Create an aborted tool result message for the chosen tool
                if (sessionState.conversationHistory && toolCall.toolUseId) {
                  sessionState.conversationHistory.push({
                    role: "user",
                    content: [
                      {
                        type: "tool_result",
                        tool_use_id: toolCall.toolUseId,
                        content: JSON.stringify({
                          aborted: true,
                          message: "Operation aborted by user"
                        })
                      } 
                    ]
                  });
                  
                  // Add to the list of tool results
                  toolResults.push({
                    toolId: toolCall.toolId,
                    args: toolCall.args as Record<string, unknown>,
                    result: {
                      aborted: true,
                      message: "Operation aborted by user"
                    },
                    toolUseId: toolCall.toolUseId,
                    aborted: true
                  });
                }
              }
              
              return createAbortResponse(toolResults, iterations, sessionState);
            }
            
            // If the model doesn't want to use a tool, it's ready to respond
            if (!toolCallChat.toolChosen) {
              logger.debug('Model chose not to use a tool, generating final response', LogCategory.MODEL);
              
              finalResponse = toolCallChat.response;
              
              break; // Exit the loop
            }

            const toolCall = toolCallChat.toolCall as ToolCall;
            
            // 2. Get the chosen tool
            logger.debug(`Model selected tool: ${toolCall.toolId}`, LogCategory.MODEL);
            const tool = toolRegistry.getTool(toolCall.toolId);
            if (!tool) {
              throw new Error(`Tool ${toolCall.toolId} not found`);
            }
            
            // Store the toolId, toolUseId, and args in the session state
            sessionState.lastToolId = toolCall.toolId;
            sessionState.lastToolUseId = toolCall.toolUseId;
            sessionState.lastArgs = toolCall.args;
            delete sessionState.lastToolError;
            
            // Check for abort before executing the tool
            if (isSessionAborted(sessionState)) {
              logger.info("Operation aborted before tool execution - stopping processing", LogCategory.SYSTEM);
              
              // Add an aborted tool result
              toolResults.push({
                toolId: toolCall.toolId,
                args: toolCall.args as Record<string, unknown>,
                result: {
                  aborted: true,
                  message: "Operation aborted by user"
                },
                toolUseId: toolCall.toolUseId,
                aborted: true
              });
              
              // Always add a tool_result message to the conversation history for this tool call
              if (sessionState.conversationHistory && toolCall.toolUseId) {
                sessionState.conversationHistory.push({
                  role: "user",
                  content: [
                    {
                      type: "tool_result",
                      tool_use_id: toolCall.toolUseId,
                      content: JSON.stringify({
                        aborted: true,
                        message: "Operation aborted by user"
                      })
                    } 
                  ]
                });
              }
              
              return createAbortResponse(toolResults, iterations, sessionState);
            }
            
            // 3. Execute the tool
            const argSummary = summarizeArgs(toolCall.args as Record<string, unknown>);
            logger.debug(`Executing tool ${tool.name} with args: ${argSummary}`, LogCategory.TOOLS);
            let result;
            try {
              // Use the new executeToolWithCallbacks method instead of direct execution
              result = await toolRegistry.executeToolWithCallbacks(
                toolCall.toolId, 
                toolCall.args as Record<string, unknown>, 
                context
              );
            } catch (error: unknown) {
              // Handle validation errors specifically
              const errorObj = error as Error;
              
              // Check if this is a permission denied error
              if (errorObj.message && errorObj.message.includes('Permission denied')) {
                logger.warn(`Permission denied for tool ${tool.name}`, LogCategory.PERMISSIONS);
                
                // Store the error in state for the model to learn from
                sessionState.lastToolError = {
                  toolId: toolCall.toolId,
                  args: toolCall.args as Record<string, unknown>,
                  error: errorObj.message
                };
                
                // Create a proper tool result message for the LLM to understand what happened
                const permissionDeniedResult = {
                  error: "Permission denied",
                  message: `The user denied permission to use the ${tool.name} tool. Please suggest an alternative approach or tool.`
                };
                
                // Add this result to the conversation history as a proper tool result
                if (sessionState.conversationHistory && toolCall.toolUseId) {
                  sessionState.conversationHistory.push({
                    role: "user",
                    content: [
                      {
                        type: "tool_result",
                        tool_use_id: toolCall.toolUseId,
                        content: JSON.stringify(permissionDeniedResult)
                      } 
                    ]
                  });
                }
                
                // Add to the list of tool results so the agent can continue
                toolResults.push({
                  toolId: toolCall.toolId,
                  args: toolCall.args as Record<string, unknown>,
                  result: permissionDeniedResult,
                  toolUseId: toolCall.toolUseId
                });
                
                // Ask the model to decide what to do next with this information
                currentQuery = `The user denied permission to use the ${tool.name} tool. Please use a different approach or tool to answer the query: ${query}`;
                
                // Skip the rest of this iteration
                continue;
              }
              else if (errorObj.message && errorObj.message.includes('Invalid args')) {
                logger.warn(`Tool argument error: ${errorObj.message}`, LogCategory.TOOLS);
                
                // Store the error in state for the model to learn from
                sessionState.lastToolError = {
                  toolId: toolCall.toolId,
                  args: toolCall.args as Record<string, unknown>,
                  error: errorObj.message
                };
                
                // Ask the model to fix the arguments
                const fixPrompt = `The tool ${tool.name} reported an error: "${errorObj.message}"
                                  Please provide corrected arguments for this tool to answer the query: ${query}
                                  Previous incorrect args: ${JSON.stringify(toolCall.args)}`;
                
                // Modify the current query for the next iteration
                currentQuery = fixPrompt;

                sessionState.conversationHistory.push({
                  role: 'user',
                  content: [
                    { type: 'tool_result', tool_use_id: toolCall.toolUseId, content: fixPrompt } 
                  ]
                });
                
                // Skip the rest of this iteration
                continue;
              } else {
                // For other errors, rethrow
                throw error;
              }
            }
            
            // 4. Update state with result
            sessionState.lastResult = result;
            
            // After tool execution, check for abort again
            if (isSessionAborted(sessionState)) {
              logger.info("Operation aborted after tool execution - stopping processing", LogCategory.SYSTEM);
              
              // In this case, we've already executed the tool and have its result
              // We should have already added the tool_result to the conversation history
              // But let's ensure it was done by checking if the last message has our tool_use_id
              
              const lastMessage = sessionState.conversationHistory && 
                sessionState.conversationHistory.length > 0 ?
                sessionState.conversationHistory[sessionState.conversationHistory.length - 1] : null;
                
              const hasToolResultMessage = lastMessage &&
                lastMessage.role === 'user' &&
                lastMessage.content &&
                Array.isArray(lastMessage.content) &&
                lastMessage.content.some(
                  (item: any) => item.type === 'tool_result' && item.tool_use_id === toolCall.toolUseId
                );
              
              // If for some reason the tool result wasn't added, add it now
              if (!hasToolResultMessage && sessionState.conversationHistory && toolCall.toolUseId) {
                sessionState.conversationHistory.push({
                  role: "user",
                  content: [
                    {
                      type: "tool_result",
                      tool_use_id: toolCall.toolUseId,
                      content: JSON.stringify(result)
                    } 
                  ]
                });
              }
              
              return createAbortResponse(toolResults, iterations, sessionState);
            }
            
            // Add tool result to conversation history if it exists
            if (sessionState.conversationHistory && toolCall.toolUseId) {
              sessionState.conversationHistory.push({
                role: "user",
                content: [
                  {
                    type: "tool_result",
                    tool_use_id: toolCall.toolUseId,
                    content: JSON.stringify(result)
                  } 
                ]
              });
            }
            
            // 5. Add to the list of tool results
            toolResults.push({
              toolId: toolCall.toolId,
              args: toolCall.args as Record<string, unknown>,
              result,
              toolUseId: toolCall.toolUseId
            });
            
            // Ask the model to decide what to do next
            currentQuery = `Based on the result of using ${tool.name}, what should I do next to answer: ${query}`;
          } catch (error: unknown) {
            logger.error(`Error in iteration ${iterations}:`, error, LogCategory.SYSTEM);
            
            // If we have at least one tool result, try to generate a response
            if (toolResults.length > 0) {
              logger.debug('Generating response from partial results due to error', LogCategory.MODEL);
              
              finalResponse = await modelClient.generateResponse(
                query,
                toolRegistry.getToolDescriptions(),
                sessionState
              );
              
              break;
            } else {
              // If we have no results, propagate the error
              throw error;
            }
          }
        }
        
        // Before generating final response, check for abort
        if (isSessionAborted(sessionState)) {
          logger.info("Operation aborted before final response - stopping processing", LogCategory.SYSTEM);
          return createAbortResponse(toolResults, iterations, sessionState);
        }
        
        // If we reached max iterations without a response, generate one
        if (!finalResponse) {
          logger.debug('Reached maximum iterations, generating response', LogCategory.MODEL);
          
          finalResponse = await modelClient.generateResponse(
            query,
            toolRegistry.getToolDescriptions(),
            sessionState
          );
          
          // Check for abort after final response generation
          if (isSessionAborted(sessionState)) {
            logger.info("Operation aborted during final response generation - stopping processing", LogCategory.SYSTEM);
            return createAbortResponse(toolResults, iterations, sessionState);
          }
        }

        // Add the assistant's response to conversation history
        if (finalResponse && finalResponse.content && finalResponse.content.length > 0) {
          (sessionState.conversationHistory as ConversationMessage[]).push({
            role: 'assistant',
            content: finalResponse.content
          });
        }
        
        // Extract the text response from the first content item
        let responseText = '';
        if (finalResponse && finalResponse.content && finalResponse.content.length > 0) {
          const firstContent = finalResponse.content[0];
          if (firstContent.type === 'text' && firstContent.text) {
            responseText = firstContent.text;
          }
        }
        
        return {
          result: {
            toolResults,
            iterations
          },
          response: responseText,
          sessionState,
          done: true,
          aborted: isSessionAborted(sessionState)
        };
      } catch (error: unknown) {
        logger.error('Error in processQuery:', error, LogCategory.SYSTEM);
        return {
          error: (error as Error).message,
          sessionState,
          done: true,
          aborted: isSessionAborted(sessionState)
        };
      }
    },
    
    /**
     * Run a conversation loop until completion
     * @param initialQuery - The initial user query
     * @returns The final result
     */
    async runConversation(initialQuery: string): Promise<ConversationResult> {
      let query = initialQuery;
      let sessionState: Record<string, unknown> = { conversationHistory: [] };
      let done = false;
      const responses: string[] = [];
      
      while (!done) {
        const result = await this.processQuery(query, sessionState);
        
        if (result.error) {
          logger.error('Error in conversation:', result.error, LogCategory.SYSTEM);
          responses.push(`Error: ${result.error}`);
          break;
        }
        
        if (result.response) {
          responses.push(result.response);
        }
        
        sessionState = result.sessionState;
        done = result.done;
        
        // If not done, we would get the next user query here
        // For automated runs, we'd need to handle this differently
        if (!done) {
          // In a real implementation, this would wait for user input
          query = 'Continue'; // Placeholder
        }
      }
      
      return {
        responses,
        sessionState
      };
    }
  };
};