/**
 * Preview generator for directory listing operations
 */

import { ToolInfo } from '../PreviewService';
import { 
  ToolPreviewData, 
  PreviewContentType,
  DirectoryPreviewData
} from '../../../../types/preview';
import { PreviewGenerator, PreviewOptions } from '../PreviewGenerator';
import { LSToolResult } from '../../../../tools/LSTool';
import { serverLogger } from '../../../logger';

export class DirectoryPreviewGenerator extends PreviewGenerator {
  /**
   * Generate preview for LS tool results
   */
  async generatePreview(
    tool: ToolInfo,
    args: Record<string, unknown>,
    result: unknown,
    options?: PreviewOptions
  ): Promise<ToolPreviewData | null> {
    const opts = { ...this.defaultOptions, ...options };
    
    // Add detailed logging for debugging
    serverLogger.debug(`DirectoryPreviewGenerator: starting preview generation for ${tool.name}`, {
      toolId: tool.id,
      argsKeys: Object.keys(args),
      resultType: result ? typeof result : 'undefined',
      resultIsNull: result === null,
      resultHasEntries: result && typeof result === 'object' && 'entries' in result,
      resultHasFiles: result && typeof result === 'object' && 'files' in result
    });
    
    try {
      // Handle LS tool results
      if (!this.isLSResult(result)) {
        serverLogger.warn('Invalid LS result format');
        return null;
      }
      
      serverLogger.debug('DirectoryPreviewGenerator: received result', {
        resultType: typeof result,
        resultKeys: result && typeof result === 'object' ? Object.keys(result) : [],
        success: result && typeof result === 'object' && 'success' in result ? result.success : 'unknown'
      });
      
      const resultObj = result as { 
        entries?: unknown[];
        files?: unknown[];
        success?: boolean;
        path?: string;
      };
      
      const dirPath = args.path as string || resultObj.path || '.';
      
      // Check if we have entries
      if (!resultObj.entries && !resultObj.files) {
        serverLogger.warn(`DirectoryPreviewGenerator: No entries found in result for ${dirPath}`);
        return {
          contentType: PreviewContentType.TEXT,
          briefContent: `Directory: ${dirPath}\n\nEmpty directory or no entries found.`,
          hasFullContent: false,
          metadata: {
            path: dirPath,
            totalEntries: 0,
            totalFiles: 0,
            totalDirectories: 0
          }
        };
      }
      
      // Get entries from result, handling different formats and enforce array type
      const rawEntries = resultObj.entries || resultObj.files || [];
      const entries = rawEntries as Array<{
        name: string;
        isDirectory: boolean;
        isFile?: boolean;
        isSymbolicLink?: boolean;
        type?: string;
        size?: number;
        mtime?: string;
        modified?: Date;
      }>;
      
      // Add more detailed logging about entries
      serverLogger.debug(`DirectoryPreviewGenerator: analyzed entries for ${dirPath}`, {
        rawEntriesLength: rawEntries.length,
        entriesLength: entries.length,
        entriesEmpty: entries.length === 0,
        firstEntryIfExists: entries.length > 0 ? {
          name: entries[0].name,
          isDirectory: entries[0].isDirectory,
          hasType: entries[0].type !== undefined,
          type: entries[0].type
        } : 'none'
      });
      
      // Count directories and files
      const directories = entries.filter(entry => Boolean(entry.isDirectory)).length;
      const files = entries.length - directories;
      
      // Format brief content (limited entries)
      const briefEntries = entries.slice(0, opts.maxBriefLines || 10);
      const briefContent = this.formatDirectoryListing(briefEntries, dirPath);
      
      // Log the generated brief content for debugging
      serverLogger.debug(`DirectoryPreviewGenerator: generated brief content for ${dirPath}`, {
        briefEntriesLength: briefEntries.length,
        briefContentLength: briefContent.length,
        briefContentEmpty: !briefContent || briefContent.trim() === '',
        briefContentSample: briefContent ? briefContent.substring(0, 100) + (briefContent.length > 100 ? '...' : '') : 'EMPTY'
      });
      
      const preview: DirectoryPreviewData = {
        contentType: PreviewContentType.DIRECTORY,
        briefContent,
        hasFullContent: entries.length > briefEntries.length,
        entries: entries.map(entry => ({
          name: String(entry.name || ''),
          isDirectory: Boolean(entry.isDirectory),
          size: typeof entry.size === 'number' ? entry.size : undefined,
          modified: entry.modified instanceof Date ? entry.modified.toISOString() : 
                    typeof entry.mtime === 'string' ? entry.mtime : undefined
        })),
        path: dirPath,
        totalFiles: files,
        totalDirectories: directories,
        metadata: {
          path: dirPath,
          totalEntries: entries.length,
          totalFiles: files,
          totalDirectories: directories
        }
      };
      
      return preview;
    } catch (error) {
      serverLogger.error('Error generating directory preview:', error);
      return null;
    }
  }
  
  /**
   * Check if this generator can handle the tool and result
   */
  canHandle(tool: ToolInfo, result: unknown): boolean {
    // Check for the exact LS tool ID
    const isLSTool = tool.id === 'ls';
    
    // Check result format
    const hasValidResult = this.isLSResult(result);
    
    return isLSTool && hasValidResult;
  }
  
  /**
   * Check if result matches LSToolResult format
   */
  private isLSResult(result: unknown): result is LSToolResult {
    return (
      result !== null &&
      typeof result === 'object' &&
      (
        // For LSToolSuccessResult format
        ('success' in result && 
          (
            // Either it has entries, files, or count
            ('entries' in result || 'files' in result || 'count' in result) ||
            // Or it's an error result with an error message
            (result.success === false && 'error' in result && typeof result.error === 'string')
          )
        ) ||
        // For other formats that don't have explicit success flag
        ('entries' in result || 'files' in result)
      )
    );
  }
  
  /**
   * Format directory listing for brief preview
   */
  private formatDirectoryListing(
    entries: Array<{
      name: string; 
      isDirectory?: boolean; 
      isFile?: boolean;
      isSymbolicLink?: boolean;
      type?: string;
      size?: number
    }>,
    path: string
  ): string {
    let output = `Directory: ${path}\n\n`;
    
    if (!entries || entries.length === 0) {
      return output + 'Empty directory';
    }
    
    for (const entry of entries) {
      // Determine entry type from all available properties
      let type = 'file'; // Default to file
      
      if (entry.type) {
        // If we have an explicit type property, use that
        type = entry.type === 'directory' || entry.type === 'dir' ? 'dir' :
               entry.type === 'symlink' ? 'sym' :
               entry.type === 'file' ? 'file' : 'other';
      } else if (entry.isDirectory) {
        type = 'dir';
      } else if (entry.isSymbolicLink) {
        type = 'sym';
      } else if (entry.isFile) {
        type = 'file';
      }
      
      const size = entry.size !== undefined ? `${this.formatSize(entry.size)}` : '';
      output += `[${type}] ${entry.name} ${size}\n`;
    }
    
    return output;
  }
  
  /**
   * Format file size to human-readable format
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}