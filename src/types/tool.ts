/**
 * Types and interfaces for tools
 */

import { GlobOptions } from "fs";
import { FileEditToolResult } from "../tools/FileEditTool";
import { FileReadToolResult } from "../tools/FileReadTool";
import { LSToolResult } from "../tools/LSTool";

/**
 * Categories for tools to classify their purpose and permission requirements
 */
export enum ToolCategory {
  FILE_OPERATION = 'file_operation',
  SHELL_EXECUTION = 'shell_execution',
  READONLY = 'readonly',
  NETWORK = 'network',
}

export interface ExecutionAdapter {
  executeCommand: (command: string, workingDir?: string) => Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }>;

  editFile: (filepath: string, searchCode: string, replaceCode: string, encoding?: string) => Promise<FileEditToolResult>;

  glob: (pattern: string, options?: GlobOptions) => Promise<string[]>;

  readFile: (filepath: string, maxSize?: number, lineOffset?: number, lineCount?: number, encoding?: string) => Promise<FileReadToolResult>;

  writeFile: (filepath: string, content: string) => Promise<void>;

  ls: (dirPath: string, showHidden?: boolean, details?: boolean) => Promise<LSToolResult>;
  
}

export interface ParameterSchema {
  type: string;
  description?: string;
  items?: ParameterSchema;
  properties?: Record<string, ParameterSchema>;
  required?: string[];
  [key: string]: unknown;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface ToolConfig {
  id: string;
  name: string;
  description: string;
  requiresPermission?: boolean;
  parameters?: Record<string, ParameterSchema>;
  requiredParameters?: string[];
  
  /**
   * Categorize tools for permission management and feature grouping
   * Can be a single category or an array of categories if tool fits multiple purposes
   */
  category?: ToolCategory | ToolCategory[];
  
  /**
   * Whether this tool should always require permission regardless of fast edit mode
   * Tools like BashTool should set this to true for security
   */
  alwaysRequirePermission?: boolean;
  
  execute: (args: Record<string, unknown>, context: ToolContext) => Promise<unknown>;
  validateArgs?: (args: Record<string, unknown>) => ValidationResult;
}

export interface ToolContext {
  permissionManager?: {
    hasPermission: (toolId: string) => boolean;
    requestPermission: (toolId: string, args: Record<string, unknown>) => Promise<boolean>;
  };
  logger?: {
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
  executionAdapter: ExecutionAdapter;
  toolRegistry?: {
    getAllTools: () => Tool[];
    getTool: (toolId: string) => Tool | undefined;
  };
  [key: string]: unknown;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  requiresPermission: boolean;
  parameters: Record<string, ParameterSchema>;
  requiredParameters: string[];
  
  /**
   * Categorize tools for permission management and feature grouping
   * Can be a single category or an array of categories if tool fits multiple purposes
   */
  category?: ToolCategory | ToolCategory[];
  
  /**
   * Whether this tool should always require permission regardless of fast edit mode
   * Tools like BashTool should set this to true for security
   */
  alwaysRequirePermission?: boolean;
  
  execute: (args: Record<string, unknown>, context: ToolContext) => Promise<unknown>;
}