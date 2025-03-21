/**
 * Types and interfaces for the agent runner
 */

import { ModelClient } from './model';
import { PermissionManager } from './permission';
import { ToolRegistry } from './registry';
import { ExecutionAdapter } from './tool';

export interface AgentRunnerConfig {
  modelClient: ModelClient;
  toolRegistry: ToolRegistry;
  permissionManager: PermissionManager;
  executionAdapter: ExecutionAdapter;
  logger?: {
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
}

export interface ToolResultEntry {
  toolId: string;
  args: Record<string, unknown>;
  result: unknown;
  toolUseId?: string;
}

export interface ProcessQueryResult {
  result?: {
    toolResults: ToolResultEntry[];
    iterations: number;
  };
  response?: string;
  sessionState: Record<string, unknown>;
  done: boolean;
  error?: string;
}

export interface ConversationResult {
  responses: string[];
  sessionState: Record<string, unknown>;
}

export interface AgentRunner {
  processQuery(query: string, sessionState?: Record<string, unknown>): Promise<ProcessQueryResult>;
  runConversation(initialQuery: string): Promise<ConversationResult>;
}

// We'll use the SessionState and ConversationMessage types from model.ts

// Legacy interfaces from the original agent.ts file
export interface AgentMessage {
  role: string;
  content: string;
}

export interface AgentResponse {
  text: string;
  [key: string]: unknown;
}

export interface ToolParameter {
  name: string;
  description: string;
  type: string;
  required: boolean;
  default?: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}