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
import { ToolCall, SessionState } from '../types/model';
import { LogCategory, createLogger, LogLevel } from '../utils/logger';
import { MESSAGE_ADDED } from '../server/services/TimelineService';

import { 
  isSessionAborted, 
  clearSessionAborted, 
  AgentEvents, 
  AgentEventType,
  formatGitInfoAsContextPrompt 
} from '../utils/sessionUtils';
import { withToolCall } from '../utils/withToolCall';
import { FsmDriver } from './FsmDriver';
import { getAbortSignal, resetAbort } from '../utils/sessionAbort';
import { createContextWindow } from '../types/contextWindow';



/**
 * Creates an agent runner to orchestrate the agent process
 * @param config - Configuration options
 * @returns The agent runner interface
 */
export const createAgentRunner = (config: AgentRunnerConfig): AgentRunner => {
  // Listen for abort events just for logging purposes
  AgentEvents.on(
    AgentEventType.ABORT_SESSION,
    (sessionId: string) => {
      console.log(`AgentRunner received abort event for session: ${sessionId}`);
    }
  );
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
    level: LogLevel.DEBUG,
    prefix: 'AgentRunner'
  });
  
  // No need for a separate helper function anymore
  
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
      const sessionId = sessionState.id as string;
      
      // Validate sessionId
      if (!sessionId) {
        logger.error('Cannot process query: Missing sessionId in session state', LogCategory.SYSTEM);
        return {
          error: 'Missing sessionId in session state',
          sessionState,
          done: true,
          aborted: false
        };
      }
      
      // Ensure we have an AbortSignal for this session (created lazily)
      const abortSignal = getAbortSignal(sessionId);
      
      // Reset abort status if it was previously set and add user message
      if (isSessionAborted(sessionId) || 
          sessionState.contextWindow.getLength() === 0 || 
          sessionState.contextWindow.getMessages()[sessionState.contextWindow.getLength() - 1].role !== 'user') {
        
        // Reset abort status if it was previously set
        if (isSessionAborted(sessionId)) {
          logger.info("Clearing abort status as new user message received", LogCategory.SYSTEM);
          // Clear from the centralized registry (legacy) and reset AbortController
          clearSessionAborted(sessionId);
          resetAbort(sessionId);
        }
        
        // Add user message to conversation history
        sessionState.contextWindow.pushUser(query);
      }
      
      try {
        // Create a logger for the FSM driver
        const fsmLogger = createLogger({
          level: LogLevel.DEBUG,
          prefix: 'FsmDriver'
        });
        
        // Create the finite state machine driver
        const driver = new FsmDriver({ 
          modelClient, 
          toolRegistry,
          permissionManager,
          executionAdapter,
          logger: fsmLogger,
          abortSignal
        });
        
        // Run the query through the FSM
        const { response, toolResults, aborted } = await driver.run(query, sessionState);
        
        // Emit an event to signal processing is completed - will be captured by WebSocketService
        AgentEvents.emit(AgentEventType.PROCESSING_COMPLETED, {
          sessionId,
          response
        });
        
        // Return the result
        return {
          sessionState,
          response,
          done: true,
          aborted,
          result: { 
            toolResults, 
            iterations: driver.iterations 
          }
        };
      } catch (error: unknown) {
        logger.error('Error in processQuery:', error, LogCategory.SYSTEM);
        
        return {
          error: (error as Error).message,
          sessionState,
          done: true,
          aborted: isSessionAborted(sessionId)
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
      let sessionState: Record<string, unknown> = { contextWindow: createContextWindow() };
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