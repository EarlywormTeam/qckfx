/**
 * GlobTool - Finds files using glob patterns
 */

import path from 'path';
import glob from 'glob';
import { promisify } from 'util';
import { createTool } from './createTool';
import { Tool, ToolContext, ValidationResult } from '../types/tool';

// Promisify glob
const globAsync = promisify(glob);

// Used for type checking in execute function
export interface GlobToolArgs {
  pattern: string;
  cwd?: string;
  dot?: boolean;
  nodir?: boolean;
  maxResults?: number;
}

interface GlobToolSuccessResult {
  success: true;
  pattern: string;
  cwd: string;
  matches: string[];
  count: number;
  hasMore: boolean;
}

interface GlobToolErrorResult {
  success: false;
  pattern: string;
  cwd: string;
  error: string;
}

export type GlobToolResult = GlobToolSuccessResult | GlobToolErrorResult;

/**
 * Creates a tool for finding files using glob patterns
 * @returns The glob tool interface
 */
export const createGlobTool = (): Tool => {
  return createTool({
    id: 'glob',
    name: 'GlobTool',
    description: 'Searches for files matching glob patterns. Use this to find files across the codebase.',
    requiresPermission: false, // Finding files is generally safe
    
    // Enhanced parameter descriptions
    parameters: {
      pattern: {
        type: "string",
        description: "The glob pattern to match files. Examples: '**/*.js', 'src/**/*.json', '*.md'"
      },
      cwd: {
        type: "string",
        description: "Base directory for the search. Use relative paths like 'src', '../', 'docs/v2' or absolute paths. Default: current directory ('.')"
      },
      dot: {
        type: "boolean",
        description: "Include .dot files in the search results. Default: false"
      },
      nodir: {
        type: "boolean",
        description: "Only return files (not directories) in the results. Default: false"
      },
      maxResults: {
        type: "number",
        description: "Limit number of results returned. Default: 1000"
      }
    },
    requiredParameters: ["pattern"],
    
    validateArgs: (args: Record<string, unknown>): ValidationResult => {
      if (!args.pattern || typeof args.pattern !== 'string') {
        return { 
          valid: false, 
          reason: 'Glob pattern must be a string' 
        };
      }
      return { valid: true };
    },
    
    execute: async (args: Record<string, unknown>, context: ToolContext): Promise<GlobToolResult> => {
      // Extract and type-cast each argument individually
      const pattern = args.pattern as string;
      const cwd = args.cwd as string || '.';
      const dot = args.dot as boolean || false;
      const nodir = args.nodir as boolean || false;
      const maxResults = args.maxResults as number || 1000;
      
      try {
        // Resolve the base path
        const resolvedCwd = path.resolve(cwd);
        
        // Set up glob options
        const options = {
          cwd: resolvedCwd,
          dot: dot, // Include .dot files if true
          nodir: nodir, // Only return files (not directories) if true
          absolute: true, // Return absolute paths
          nosort: false, // Sort the results
          silent: true, // Don't throw on permission errors etc.
          limit: maxResults // Limit number of results
        };
        
        // Execute the glob
        context.logger?.debug(`Executing glob: ${pattern} in ${resolvedCwd}`);
        const matches = await globAsync(pattern, options);
        
        return {
          success: true,
          pattern,
          cwd: resolvedCwd,
          matches,
          count: matches.length,
          hasMore: matches.length >= maxResults
        };
      } catch (error: unknown) {
        const err = error as Error;
        context.logger?.error(`Error in glob search: ${err.message}`);
        return {
          success: false,
          pattern,
          cwd,
          error: err.message
        };
      }
    }
  });
};