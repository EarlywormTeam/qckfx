/**
 * Agent Framework - Main entry point
 * 
 * This framework provides a modular, composition-based approach to building AI agents.
 * It follows a tool-based architecture where each capability is a separate module
 * that can be composed together.
 */

// Core components
import { createAgentRunner } from './core/AgentRunner';
import { createToolRegistry } from './core/ToolRegistry';
import { createPermissionManager } from './core/PermissionManager';
import { createModelClient } from './core/ModelClient';

// Providers
import { createAnthropicProvider } from './providers/AnthropicProvider';

// Tools
import { createTool } from './tools/createTool';
import { createBashTool } from './tools/BashTool';
import { createGlobTool } from './tools/GlobTool';
import { createGrepTool } from './tools/GrepTool';
import { createLSTool } from './tools/LSTool';
import { createFileReadTool } from './tools/FileReadTool';
import { createFileEditTool } from './tools/FileEditTool';
import { createFileWriteTool } from './tools/FileWriteTool';
import { createScratchpadTool } from './tools/ScratchpadTool';

// Utils
import { createLogger, LogLevel } from './utils/logger';
import { createErrorHandler, createError } from './utils/ErrorHandler';

// Types
import { Agent, AgentConfig } from './types/main';
import { Tool } from './types/tool';
import { ErrorType } from './types/error';
import { ModelProvider } from './types/model';
import { LocalExecutionAdapter } from './utils/LocalExecutionAdapter';
/**
 * Creates a complete agent with default tools
 * @param config - Agent configuration
 * @returns The configured agent
 */
const createAgent = (config: AgentConfig): Agent => {
  if (!config.modelProvider) {
    throw new Error('Agent requires a modelProvider function');
  }
  
  // Create core components
  const logger = config.logger || createLogger({ level: LogLevel.INFO });
  
  const permissionManager = createPermissionManager({
    uiHandler: config.permissionUIHandler
  });
  
  const modelClient = createModelClient({
    modelProvider: config.modelProvider as ModelProvider
  });
  
  const toolRegistry = createToolRegistry();
  
  // Create and register default tools
  const tools: Tool[] = [
    createBashTool(),
    createGlobTool(),
    createGrepTool(),
    createLSTool(),
    createFileReadTool(),
    createFileEditTool(),
    createFileWriteTool(),
    createScratchpadTool()
  ];
  
  tools.forEach(tool => toolRegistry.registerTool(tool));
  
  // Create the agent runner
  const agentRunner = createAgentRunner({
    modelClient,
    toolRegistry,
    permissionManager,
    logger,
    executionAdapter: new LocalExecutionAdapter()
  });
  
  // Create state manager
  
  // Return the complete agent interface
  return {
    // Core components
    agentRunner,
    toolRegistry,
    permissionManager,
    modelClient,
    logger,
    
    // Helper methods
    async processQuery(query, sessionState = { conversationHistory: [] }) {
      return agentRunner.processQuery(query, sessionState);
    },
    
    async runConversation(initialQuery) {
      return agentRunner.runConversation(initialQuery);
    },
    
    registerTool(tool) {
      toolRegistry.registerTool(tool);
    }
  };
};

// Export everything
export {
  // Factory function
  createAgent,
  
  // Core components
  createAgentRunner,
  createToolRegistry,
  createPermissionManager,
  createModelClient,
  
  // Providers
  createAnthropicProvider,
  
  // Tools
  createTool,
  createBashTool,
  createGlobTool,
  createGrepTool,
  createLSTool,
  createFileReadTool,
  createFileEditTool,
  createFileWriteTool,
  
  // Utils
  createLogger,
  LogLevel,
  createErrorHandler,
  createError,
  ErrorType,
};