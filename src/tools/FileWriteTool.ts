/**
 * FileWriteTool - Creates new files
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { createTool } from './createTool';
import { Tool, ToolContext, ValidationResult } from '../types/tool';

// Promisify fs functions for async/await usage
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);
const statAsync = promisify(fs.stat);

// Removed unused interface
// interface FileWriteToolArgs {
//   path: string;
//   content: string;
//   encoding?: string;
//   overwrite?: boolean;
//   createDir?: boolean;
// }

interface FileWriteToolSuccessResult {
  success: true;
  path: string;
  content: string;
  encoding: string;
}

interface FileWriteToolErrorResult {
  success: false;
  path: string;
  error: string;
}

export type FileWriteToolResult = FileWriteToolSuccessResult | FileWriteToolErrorResult;

/**
 * Creates a tool for writing new files
 * @returns The file write tool interface
 */
export const createFileWriteTool = (): Tool => {
  return createTool({
    id: 'file_write',
    name: 'FileWriteTool',
    description: 'Creates a new file with the specified content.',
    requiresPermission: true,
    
    // Enhanced parameter descriptions
    parameters: {
      path: {
        type: "string",
        description: "Path where the file should be created. Can be relative like 'src/newfile.js', '../data.json' or absolute"
      },
      content: {
        type: "string",
        description: "Content to write to the file"
      },
      encoding: {
        type: "string",
        description: "File encoding to use. Default: 'utf8'"
      },
      overwrite: {
        type: "boolean",
        description: "Whether to overwrite the file if it already exists. Default: false"
      },
      createDir: {
        type: "boolean",
        description: "Whether to create parent directories if they don't exist. Default: true"
      }
    },
    requiredParameters: ["path", "content"],
    
    validateArgs: (args: Record<string, unknown>): ValidationResult => {
      if (!args.path || typeof args.path !== 'string') {
        return { 
          valid: false, 
          reason: 'File path must be a string' 
        };
      }
      
      if (args.content === undefined) {
        return {
          valid: false,
          reason: 'File content must be provided'
        };
      }
      
      return { valid: true };
    },
    
    execute: async (args: Record<string, unknown>, context: ToolContext): Promise<FileWriteToolResult> => {
      // Extract and type-cast each argument individually
      const filePath = args.path as string;
      const content = args.content as string;
      const encoding = args.encoding as string || 'utf8';
      const overwrite = args.overwrite as boolean || false;
      const createDir = args.createDir as boolean ?? true;
      
      try {
        // Resolve the path
        const resolvedPath = path.resolve(filePath);
        const dirPath = path.dirname(resolvedPath);
        
        // Check if file already exists
        try {
          const stats = await statAsync(resolvedPath);
          
          if (stats.isFile() && !overwrite) {
            return {
              success: false,
              path: filePath,
              error: `File already exists: ${filePath}. Set overwrite to true to replace it.`
            };
          }
        } catch (error: unknown) {
          // File doesn't exist, which is what we want
          const err = error as Error & { code?: string };
          if (err.code !== 'ENOENT') {
            throw error; // Re-throw unexpected errors
          }
        }
        
        // Create directory if it doesn't exist
        if (createDir) {
          try {
            await mkdirAsync(dirPath, { recursive: true });
          } catch (error: unknown) {
            const err = error as Error & { code?: string };
            if (err.code !== 'EEXIST') {
              throw error;
            }
          }
        }
        
        // Write the file
        context.logger?.debug(`Creating file: ${resolvedPath}`);
        await writeFileAsync(resolvedPath, content, encoding as BufferEncoding);
        
        return {
          success: true,
          path: resolvedPath,
          content,
          encoding
        };
      } catch (error: unknown) {
        const err = error as Error;
        context.logger?.error(`Error writing file: ${err.message}`);
        return {
          success: false,
          path: filePath,
          error: err.message
        };
      }
    }
  });
};