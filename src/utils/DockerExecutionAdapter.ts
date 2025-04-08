import path from 'path';
import { GlobOptions } from 'fs';
import { ExecutionAdapter } from '../types/tool';
import { FileEditToolErrorResult, FileEditToolSuccessResult } from '../tools/FileEditTool';
import { FileReadToolErrorResult, FileReadToolSuccessResult } from '../tools/FileReadTool';
import { FileEntry, LSToolErrorResult, LSToolSuccessResult } from '../tools/LSTool';
import { DockerContainerManager, ContainerInfo } from './DockerContainerManager';
import { LogCategory } from './logger';
import { AgentEvents, AgentEventType, EnvironmentStatusEvent } from './sessionUtils';

/**
 * Execution adapter that runs commands in a Docker container
 */
export class DockerExecutionAdapter implements ExecutionAdapter {
  private containerManager: DockerContainerManager;
  private logger?: {
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
  private lastEmittedStatus?: 'initializing' | 'connecting' | 'connected' | 'disconnected' | 'error';

  /**
   * Create a Docker execution adapter with a container manager
   */
  constructor(
    containerManager: DockerContainerManager,
    options?: {
      logger?: {
        debug: (message: string, ...args: unknown[]) => void;
        info: (message: string, ...args: unknown[]) => void;
        warn: (message: string, ...args: unknown[]) => void;
        error: (message: string, ...args: unknown[]) => void;
      }
    }
  ) {
    this.containerManager = containerManager;
    this.logger = options?.logger;
    
    // Start container initialization immediately in the background
    // Fire and forget - we don't await this promise in the constructor
    this.initializeContainer().catch(error => {
      this.logger?.error(`Background Docker initialization failed: ${(error as Error).message}`, error, LogCategory.SYSTEM);
    });
  }
  
  /**
   * Initialize the Docker container in the background
   * This allows eager initialization without blocking construction
   * @returns Promise that resolves when container is initialized
   */
  public initializeContainer(): Promise<ContainerInfo | null> {
    this.logger?.info('Starting Docker container initialization', LogCategory.SYSTEM);
    
    // Emit initializing status
    this.emitEnvironmentStatus('initializing', false);
    
    // Return the promise instead of using .then() so caller can await if needed
    return this.containerManager.ensureContainer()
      .then(container => {
        if (container) {
          this.logger?.info('Docker container initialized successfully', LogCategory.SYSTEM);
          
          // Emit connected and ready status
          this.emitEnvironmentStatus('connected', true);
        } else {
          this.logger?.warn('Docker container initialization failed', LogCategory.SYSTEM);
          
          // Emit error status
          this.emitEnvironmentStatus('error', false, 'Failed to initialize Docker container');
        }
        return container;
      })
      .catch(error => {
        this.logger?.error(`Error initializing Docker container: ${(error as Error).message}`, error, LogCategory.SYSTEM);
        
        // Emit error status
        this.emitEnvironmentStatus('error', false, (error as Error).message);
        
        throw error;
      });
  }
  
  /**
   * Emit environment status event
   */
  private emitEnvironmentStatus(
    status: 'initializing' | 'connecting' | 'connected' | 'disconnected' | 'error',
    isReady: boolean,
    error?: string
  ): void {
    // Skip if this status was already emitted
    if (this.lastEmittedStatus === status) {
      this.logger?.debug(`Skipping duplicate Docker environment status: ${status}`, LogCategory.SYSTEM);
      return;
    }
    
    // Special handling for "initializing" status - only emit if previously disconnected or error
    if (status === 'initializing' && 
        this.lastEmittedStatus && 
        !['disconnected', 'error', undefined].includes(this.lastEmittedStatus)) {
      this.logger?.debug(`Skipping redundant initializing status (current: ${this.lastEmittedStatus})`, LogCategory.SYSTEM);
      return;
    }

    console.log('Emitting environment status:', status, this.lastEmittedStatus);
    // Update last emitted status
    this.lastEmittedStatus = status;
    
    const statusEvent: EnvironmentStatusEvent = {
      environmentType: 'docker',
      status,
      isReady,
      error
    };
    
    this.logger?.info(`Emitting Docker environment status: ${status}, ready=${isReady}`, LogCategory.SYSTEM);
    AgentEvents.emit(AgentEventType.ENVIRONMENT_STATUS_CHANGED, statusEvent);
  }

  /**
   * Execute a command in the Docker container
   */
  async executeCommand(command: string, workingDir?: string): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    try {
      // Convert working directory to container path if provided
      let containerWorkingDir: string | undefined;
      
      if (workingDir) {
        const containerInfo = await this.containerManager.getContainerInfo();
        if (!containerInfo) {
          throw new Error('Container is not available');
        }
        
        containerWorkingDir = this.toContainerPath(workingDir, containerInfo);
      }
      
      this.logger?.debug(`Executing command in container: ${command}`, LogCategory.TOOLS);
      
      // Try to execute the command
      try {
        const result = await this.containerManager.executeCommand(command, containerWorkingDir);
        return result;
      } catch (error) {
        // Check if container needs to be restarted
        if ((error as Error).message.includes('container not running') || 
            (error as Error).message.includes('No such container')) {
          
          this.logger?.warn('Container not running, attempting to restart', LogCategory.TOOLS);
          
          // Update status to disconnected before restarting
          this.emitEnvironmentStatus('disconnected', false);
          
          // Try to restart container
          const containerInfo = await this.containerManager.ensureContainer();
          if (!containerInfo) {
            this.emitEnvironmentStatus('error', false, 'Failed to restart container');
            throw new Error('Failed to restart container');
          }
          
          // Reconnected successfully
          this.emitEnvironmentStatus('connected', true);
          
          // Retry command after restart
          const retryResult = await this.containerManager.executeCommand(command, containerWorkingDir);
          return retryResult;
        }
        
        // If it's not a container availability issue, rethrow
        throw error;
      }
    } catch (error) {
      this.logger?.error(`Error executing command in container: ${(error as Error).message}`, error, LogCategory.TOOLS);
      return {
        stdout: '',
        stderr: `Error executing command: ${(error as Error).message}`,
        exitCode: 1
      };
    }
  }

  /**
   * Read a file from the container
   */
  async readFile(filepath: string, maxSize?: number, lineOffset?: number, lineCount?: number, encoding?: string): Promise<FileReadToolSuccessResult | FileReadToolErrorResult> {
    try {
      if (!encoding) {
        encoding = 'utf8';
      }
      if (!maxSize) {
        maxSize = 1048576; // 1MB default
      }
      if (!lineOffset) {
        lineOffset = 0;
      }
      
      // Get container info
      const containerInfo = await this.containerManager.getContainerInfo();
      if (!containerInfo) {
        return {
          success: false as const,
          path: filepath,
          error: 'Container is not available'
        };
      }
      
      // Convert to container path
      const containerPath = this.toContainerPath(filepath, containerInfo);
      
      // Check if file exists
      const { exitCode: fileExists } = await this.executeCommand(`[ -f "${containerPath}" ]`);
      if (fileExists !== 0) {
        // Format path for display
        const displayPath = this.formatPathForDisplay(filepath, containerInfo);
        
        return {
          success: false as const,
          path: filepath,
          displayPath,
          error: `File does not exist: ${displayPath}`
        };
      }
      
      // Check file size
      const { stdout: fileSizeStr } = await this.executeCommand(`stat -c %s "${containerPath}"`);
      const fileSize = parseInt(fileSizeStr.trim(), 10);
      
      if (isNaN(fileSize)) {
        // Format path for display
        const displayPath = this.formatPathForDisplay(filepath, containerInfo);
        
        return {
          success: false as const,
          path: filepath,
          displayPath,
          error: `Unable to determine file size: ${displayPath}`
        };
      }
      
      if (fileSize > maxSize) {
        // Format path for display
        const displayPath = this.formatPathForDisplay(filepath, containerInfo);
        
        return {
          success: false as const,
          path: filepath,
          displayPath,
          error: `File is too large (${fileSize} bytes) to read. Max size: ${maxSize} bytes`
        };
      }
      
      // Read file content
      let command = `nl "${containerPath}"`;
      if (lineOffset > 0 || lineCount !== undefined) {
        command = `head -n ${lineOffset + (lineCount || 0)} "${containerPath}" | tail -n ${lineCount || '+0'} | nl -v ${lineOffset + 1}`;
      }
      
      const { stdout: content, stderr, exitCode } = await this.executeCommand(command);
      
      if (exitCode !== 0) {
        return {
          success: false as const,
          path: filepath,
          error: stderr || `Failed to read file: ${filepath}`
        };
      }
      
      // If we need to report pagination info
      if (lineOffset > 0 || lineCount !== undefined) {
        // Get total lines
        const { stdout: lineCountStr } = await this.executeCommand(`wc -l < "${containerPath}"`);
        const totalLines = parseInt(lineCountStr.trim(), 10);
        
        const startLine = lineOffset;
        const endLine = lineCount !== undefined 
          ? Math.min(startLine + lineCount, totalLines) 
          : totalLines;
        
        // Format path for display
        const displayPath = this.formatPathForDisplay(filepath, containerInfo);
        
        return {
          success: true as const,
          path: filepath,
          displayPath, // Add formatted path for UI display
          content: content,
          size: fileSize,
          encoding,
          pagination: {
            totalLines,
            startLine,
            endLine,
            hasMore: endLine < totalLines
          }
        };
      }
      
      // Format path for display
      const displayPath = this.formatPathForDisplay(filepath, containerInfo);
      
      return {
        success: true as const,
        path: filepath,
        displayPath, // Add formatted path for UI display
        content: content,
        size: fileSize,
        encoding
      };
    } catch (error) {
      return {
        success: false as const,
        path: filepath,
        error: `Error reading file: ${(error as Error).message}`
      };
    }
  }

  /**
   * Write content to a file in the container
   */
  async writeFile(filepath: string, content: string): Promise<void> {
    try {
      // Get container info
      const containerInfo = await this.containerManager.getContainerInfo();
      if (!containerInfo) {
        throw new Error('Container is not available');
      }
      
      // Make sure the path is within the working directory
      if (!this.isPathWithinWorkingDir(filepath, containerInfo)) {
        throw new Error(`Security constraint: Can only write to paths within the working directory. Attempted to write to ${filepath}`);
      }
      
      const containerPath = this.toContainerPath(filepath, containerInfo);
      
      // Create directory if it doesn't exist
      await this.executeCommand(`mkdir -p "$(dirname "${containerPath}")"`);
      
      // Write content to file using a heredoc to handle multi-line content
      await this.executeCommand(`cat > "${containerPath}" << 'EOF_QCKFX'\n${content}\nEOF_QCKFX`);
    } catch (error) {
      throw new Error(`Failed to write file: ${(error as Error).message}`);
    }
  }

  /**
   * Edit a file by replacing content
   */
  async editFile(filepath: string, searchCode: string, replaceCode: string, encoding?: string): Promise<FileEditToolSuccessResult | FileEditToolErrorResult> {
    if (!encoding) {
      encoding = 'utf8';
    }
    
    try {
      // Get container info
      const containerInfo = await this.containerManager.getContainerInfo();
      if (!containerInfo) {
        return {
          success: false as const,
          path: filepath,
          error: 'Container is not available'
        };
      }
      
      // Make sure the path is within the working directory
      if (!this.isPathWithinWorkingDir(filepath, containerInfo)) {
        return {
          success: false as const,
          path: filepath,
          error: `Security constraint: Can only modify files within the working directory. Attempted to modify ${filepath}`
        };
      }
      
      // Read the file content
      const fileResult = await this.readFile(filepath);
      if (!fileResult.success) {
        return {
          success: false as const,
          path: filepath,
          displayPath: fileResult.displayPath || this.formatPathForDisplay(filepath, containerInfo),
          error: fileResult.error
        };
      }
      
      const fileContent = fileResult.content;
      
      // Count occurrences of the search code
      const occurrences = fileContent.split(searchCode).length - 1;
      
      if (occurrences === 0) {
        // Format path for display
        const displayPath = this.formatPathForDisplay(filepath, containerInfo);
        
        return {
          success: false as const,
          path: filepath,
          displayPath,
          error: `Search code not found in file: ${displayPath}`
        };
      }
      
      if (occurrences > 1) {
        // Format path for display
        const displayPath = this.formatPathForDisplay(filepath, containerInfo);
        
        return {
          success: false as const,
          path: filepath,
          displayPath,
          error: `Found ${occurrences} instances of the search code. Please provide a more specific search code that matches exactly once.`
        };
      }
      
      // Replace the code (only one match at this point)
      const newContent = fileContent.replace(searchCode, replaceCode);
      
      // Write the new content
      await this.writeFile(filepath, newContent);
      
      // Format path for display
      const displayPath = this.formatPathForDisplay(filepath, containerInfo);
      
      return {
        success: true as const,
        path: filepath,
        displayPath,
        originalContent: fileContent,
        newContent: newContent
      };
    } catch (error) {
      return {
        success: false as const,
        path: filepath,
        displayPath: filepath, // Use original path for display in case of early errors
        error: `Error editing file: ${(error as Error).message}`
      };
    }
  }

  /**
   * Find files matching a glob pattern
   */
  async glob(pattern: string, _options?: GlobOptions): Promise<string[]> {
    try {
      // Get container info
      const containerInfo = await this.containerManager.getContainerInfo();
      if (!containerInfo) {
        return [];
      }
      
      // Convert to container path pattern if it starts with a path
      const containerPattern = pattern.startsWith('/') 
        ? this.toContainerPath(pattern, containerInfo)
        : pattern;
      
      // Use find command with -path for glob-like behavior
      const { stdout, exitCode } = await this.executeCommand(`find ${containerInfo.workspacePath} -path "${containerPattern}" -type f | sort`);
      
      if (exitCode !== 0 || !stdout.trim()) {
        return [];
      }
      
      // Convert container paths back to host paths
      return stdout.trim().split('\n')
        .filter(line => line.length > 0)
        .map(containerPath => this.toHostPath(containerPath, containerInfo));
    } catch (error) {
      this.logger?.error(`Error in glob: ${(error as Error).message}`, error, 'tools');
      return [];
    }
  }

  /**
   * List directory contents
   */
  async ls(dirPath: string, showHidden: boolean = false, details: boolean = false): Promise<LSToolSuccessResult | LSToolErrorResult> {
    try {
      // Get container info
      const containerInfo = await this.containerManager.getContainerInfo();
      if (!containerInfo) {
        return {
          success: false as const,
          path: dirPath,
          error: 'Container is not available'
        };
      }
      
      // Convert to container path
      const containerPath = this.toContainerPath(dirPath, containerInfo);
      
      // Check if directory exists
      const { exitCode } = await this.executeCommand(`[ -d "${containerPath}" ]`);
      
      if (exitCode !== 0) {
        return {
          success: false as const,
          path: dirPath,
          error: `Directory does not exist: ${dirPath}`
        };
      }
      
      // Get directory entries with a single command
      let command: string;
      
      if (details) {
        // Use BusyBox compatible commands instead of GNU find with -printf
        // Use ls -la for detailed listing with all information
        command = `ls -la "${containerPath}" ${showHidden ? '' : '| grep -v "^\\..*"'}`;
      } else {
        // Simple listing
        command = `ls -1${showHidden ? 'a' : ''} "${containerPath}" ${showHidden ? '' : '| grep -v "^\\..*"'}`;
      }
      
      const { stdout, stderr, exitCode: lsExitCode } = await this.executeCommand(command);
      
      if (lsExitCode !== 0) {
        return {
          success: false as const,
          path: dirPath,
          error: stderr || `Failed to list directory: ${dirPath}`
        };
      }
      
      // Parse entries
      const results: FileEntry[] = [];
      
      if (details) {
        // Parse the detailed output from ls -la
        // Example output: 
        // total 24
        // drwxr-xr-x 2 user user 4096 Apr 19 12:34 .
        // drwxr-xr-x 3 user user 4096 Apr 19 12:34 ..
        // -rw-r--r-- 1 user user  123 Apr 19 12:34 file.txt
        // drwxr-xr-x 2 user user 4096 Apr 19 12:34 dir
        // lrwxrwxrwx 1 user user    8 Apr 19 12:34 link -> file.txt
        
        const lines = stdout.trim().split('\n');
        
        // Skip the first line which shows the total size
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          // Split by whitespace, but be aware that filenames might contain spaces
          const parts = line.split(/\s+/);
          if (parts.length < 7) continue; // Need at least enough parts for a valid entry
          
          // First character of permissions indicates type
          const typeChar = parts[0][0];
          const isDirectory = typeChar === 'd';
          const isSymbolicLink = typeChar === 'l';
          const isFile = typeChar === '-';
          
          // Determine the entry name - it's everything after the timestamp
          // This is tricky because filenames can have spaces
          const dateTimeParts = 5; // Assuming we have at least "Apr 19 12:34" (5 parts)
          const nameStart = parts.slice(0, 5 + dateTimeParts).join(' ').length + 1;
          let name = line.substring(nameStart).trim();
          
          // For symlinks, remove the " -> target" part
          if (isSymbolicLink && name.includes(' -> ')) {
            name = name.split(' -> ')[0];
          }
          
          // Skip . and .. entries
          if (name === '.' || name === '..') continue;
          
          // Get the size
          const size = parseInt(parts[4], 10);
          
          // Add the entry
          results.push({
            name,
            type: isDirectory ? 'directory' : isFile ? 'file' : isSymbolicLink ? 'symlink' : 'other',
            size: isNaN(size) ? 0 : size,
            isDirectory,
            isFile,
            isSymbolicLink
          });
        }
        
        // Log the results for debugging
        this.logger?.debug(`Parsed ${results.length} entries from ls -la output`, LogCategory.TOOLS);
      } else {
        // For simple listing, just do an ls -la anyway to get the file types correctly
        // This avoids multiple commands and is more efficient
        const { stdout: detailedOutput } = await this.executeCommand(`ls -la "${containerPath}"`);
        const detailedLines = detailedOutput.trim().split('\n');
        
        // Parse detailed output to get file types
        const typeMap = new Map<string, { isDir: boolean, isFile: boolean, isLink: boolean }>();
        
        // Skip the first line which shows the total size
        for (let i = 1; i < detailedLines.length; i++) {
          const line = detailedLines[i].trim();
          if (!line) continue;
          
          // Split by whitespace
          const parts = line.split(/\s+/);
          if (parts.length < 7) continue;
          
          // First character of permissions indicates type
          const typeChar = parts[0][0];
          
          // Determine the entry name
          const dateTimeParts = 5; // Assuming we have at least "Apr 19 12:34" (5 parts)
          const nameStart = parts.slice(0, 5 + dateTimeParts).join(' ').length + 1;
          let name = line.substring(nameStart).trim();
          
          // For symlinks, remove the " -> target" part
          if (typeChar === 'l' && name.includes(' -> ')) {
            name = name.split(' -> ')[0];
          }
          
          // Skip . and .. entries
          if (name === '.' || name === '..') continue;
          
          // Skip hidden files if not showing them
          if (!showHidden && name.startsWith('.')) continue;
          
          typeMap.set(name, {
            isDir: typeChar === 'd',
            isFile: typeChar === '-',
            isLink: typeChar === 'l'
          });
        }
        
        // Now process the simple listing
        const entries = stdout.trim().split('\n')
          .filter(name => name && name !== '.' && name !== '..');
        
        for (const name of entries) {
          const typeInfo = typeMap.get(name) || { isDir: false, isFile: true, isLink: false };
          
          let type = 'file'; // default to file
          if (typeInfo.isDir) type = 'directory';
          else if (typeInfo.isLink) type = 'symlink';
          
          results.push({
            name,
            type,
            isDirectory: typeInfo.isDir,
            isFile: typeInfo.isFile,
            isSymbolicLink: typeInfo.isLink
          });
        }
      }
      
      return {
        success: true as const,
        path: dirPath,
        entries: results,
        count: results.length
      };
    } catch (error) {
      this.logger?.error(`Error listing directory: ${(error as Error).message}`, error, LogCategory.TOOLS);
      return {
        success: false as const,
        path: dirPath,
        error: `Error listing directory: ${(error as Error).message}`
      };
    }
  }

  /**
   * Convert a host path to a container path
   */
  private toContainerPath(hostPath: string, containerInfo: ContainerInfo): string {
    // If path is already a container path starting with workspace path, return as is
    if (hostPath === containerInfo.workspacePath || 
        (hostPath.startsWith(containerInfo.workspacePath) && 
         (hostPath.length === containerInfo.workspacePath.length || 
          hostPath[containerInfo.workspacePath.length] === '/'))) {
      return hostPath;
    }
    
    // Ensure absolute path
    const absolutePath = path.isAbsolute(hostPath) 
      ? hostPath 
      : path.resolve(hostPath);
    
    // Check if path is within project directory
    if (absolutePath.startsWith(containerInfo.projectPath)) {
      return path.join(
        containerInfo.workspacePath,
        path.relative(containerInfo.projectPath, absolutePath)
      );
    }
    
    // For paths outside project directory, throw error
    throw new Error(`Path is outside project directory: ${hostPath}`);
  }

  /**
   * Convert a container path to a host path
   */
  private toHostPath(containerPath: string, containerInfo: ContainerInfo): string {
    if (containerPath.startsWith(containerInfo.workspacePath)) {
      return path.join(
        containerInfo.projectPath,
        containerPath.substring(containerInfo.workspacePath.length + 1)
      );
    }
    return containerPath;
  }
  
  /**
   * Format a path for display by converting absolute paths to relative ones
   * This is used in tool results to show more user-friendly paths
   */
  private formatPathForDisplay(absolutePath: string, containerInfo: ContainerInfo): string {
    // If it's a container path, convert to relative project path
    if (absolutePath.startsWith(containerInfo.workspacePath)) {
      return path.posix.relative(containerInfo.workspacePath, absolutePath);
    }
    
    // If it's a host path, try to make it relative to the project directory
    if (absolutePath.startsWith(containerInfo.projectPath)) {
      return path.relative(containerInfo.projectPath, absolutePath);
    }
    
    // If path is outside known directories, return as is
    return absolutePath;
  }

  /**
   * Check if a path is within the working directory
   */
  private isPathWithinWorkingDir(filepath: string, containerInfo: ContainerInfo): boolean {
    // Special case for workspace path inside container
    if (filepath === containerInfo.workspacePath) {
      return true;
    }
    
    const absolutePath = path.isAbsolute(filepath) 
      ? filepath 
      : path.resolve(filepath);
    
    return absolutePath.startsWith(containerInfo.projectPath);
  }
}