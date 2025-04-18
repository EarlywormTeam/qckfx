/**
 * Test helpers for the FSM driver tests
 */

import { ModelClient } from '../types/model';
import { ToolRegistry } from '../types/registry';
import { ToolContext, ExecutionAdapter, ToolCategory } from '../types/tool';
import { FileEditToolResult } from '../tools/FileEditTool';
import { FileReadToolResult } from '../tools/FileReadTool';
import { LSToolResult } from '../tools/LSTool';
import { Logger, LogLevel, LogCategory } from '../utils/logger';

/**
 * Creates a fake model client for testing
 */
export function fakeModelClient(opts: {
  // when true model returns tool_use on first call, otherwise "none"
  chooseTool?: boolean;
  // optional second-model-call behaviour
  secondChooseTool?: boolean;
}): ModelClient {
  let callCount = 0;
  return {
    formatToolsForClaude: () => [],
    async getToolCall(
      query: string, 
      toolDescriptions: any[], 
      sessionState: any, 
      options?: { signal?: AbortSignal, tool_choice?: any }
    ) {
      // Check if aborted
      if (options?.signal?.aborted) {
        throw new Error('AbortError');
      }
      
      callCount++;
      if (callCount === 1 && opts.chooseTool) {
        return {
          toolChosen: true,
          toolCall: { toolId: 'grep', toolUseId: 't1', args: { pattern: 'foo' } },
        };
      } else if (callCount === 2 && opts.secondChooseTool) {
        return {
          toolChosen: true,
          toolCall: { toolId: 'grep', toolUseId: 't2', args: { pattern: 'bar' } },
        };
      }
      
      return { 
        toolChosen: false, 
        response: {
          id: 'r1', 
          role: 'assistant',
          content: [{ type: 'text', text: 'done' }]
        }
      };
    },
    async generateResponse(
      query: string, 
      toolDescriptions: any[], 
      sessionState: any,
      options?: { signal?: AbortSignal, tool_choice?: any }
    ) {
      return {
        id: 'r2', 
        role: 'assistant',
        content: [{ type: 'text', text: 'fallback' }]
      };
    },
  } as unknown as ModelClient;
}

/**
 * Creates a stubbed tool registry for testing
 */
export function stubToolRegistry(abortBehavior?: 'never-resolves'): {
  registry: ToolRegistry;
  calls: { toolId: string; args: Record<string, unknown> }[];
} {
  const calls: { toolId: string; args: Record<string, unknown> }[] = [];
  
  // Create a fake registry
  const registry = {
    getToolDescriptions: () => [{
      id: 'grep',
      name: 'grep',
      description: 'grep tool for testing',
      parameters: {}
    }],
    getTool: () => ({
      id: 'grep',
      name: 'grep',
      description: 'grep tool for testing',
      requiresPermission: false,
      parameters: {},
      category: 'readonly'
    }),
    getAllTools: () => [],
    executeToolWithCallbacks: async (toolId: string, toolUseId: string, args: Record<string, unknown>, context: ToolContext) => {
      calls.push({ toolId, args });
      
      // Check for abort signal before proceeding
      if (context.abortSignal?.aborted) {
        throw new Error('AbortError');
      }
      
      if (abortBehavior === 'never-resolves') {
        // Return a promise that never resolves, used for testing abort during tool execution
        return new Promise((resolve) => {
          // This promise deliberately never resolves
        });
      }
      
      return { ok: true };
    }
  } as unknown as ToolRegistry;
  
  return { registry, calls };
}

/**
 * Creates a stub logger for testing
 */
export function stubLogger(): Logger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setContext: jest.fn(),
    level: LogLevel.DEBUG,
    prefix: 'TestLogger',
    silent: false,
    formatOptions: {
      showTimestamp: false,
      showPrefix: true,
      colors: false
    },
    enabledCategories: [
      LogCategory.SYSTEM,
      LogCategory.TOOLS,
      LogCategory.MODEL
    ]
  } as unknown as Logger;
}

/**
 * Creates a stub permission manager for testing
 */
export function stubPermissionManager() {
  return {
    requestPermission: async () => true,
    setFastEditMode: () => {},
    isFastEditMode: () => false,
    shouldRequirePermission: () => false,
    enableDangerMode: () => {},
    disableDangerMode: () => {},
    isDangerModeEnabled: () => false
  };
}

/**
 * Creates a stub execution adapter for testing
 */
export function stubExecutionAdapter(): ExecutionAdapter {
  return {
    executeCommand: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
    editFile: async (): Promise<FileEditToolResult> => ({
      success: true,
      path: '/test/path',
      originalContent: 'original',
      newContent: 'modified'
    }),
    glob: async () => [],
    readFile: async (): Promise<FileReadToolResult> => ({
      success: true,
      path: '/test/path',
      content: '',
      size: 0,
      encoding: 'utf-8'
    }),
    writeFile: async () => {},
    ls: async (): Promise<LSToolResult> => ({
      success: true,
      path: '/test/path',
      entries: [],
      count: 0
    }),
    generateDirectoryMap: async () => '',
    getGitRepositoryInfo: async () => null
  } as ExecutionAdapter;
}