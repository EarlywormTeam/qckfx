import React from 'react';
import { cn } from '../../lib/utils';
import { ToolExecution } from '../../hooks/useToolStream';
import { ToolState } from '../../types/terminal';

// Helper function to truncate strings
const truncateString = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
};

// Helper function to get a meaningful description of what the tool is doing
const getToolDescription = (tool: ToolExecution): string => {
  // List of generic descriptions to override
  const genericDescriptions = [
    'Tool execution result', 
    'Tool execution', 
    'Execution result',
    'Result',
    'Complete'
  ];
  
  // If we have a paramSummary that's not generic, use that as the primary source
  if (tool.paramSummary && !genericDescriptions.includes(tool.paramSummary.trim())) {
    return truncateString(tool.paramSummary, 100);
  }
  
  // If we have result object with a pattern field (common in search tools)
  if (tool.result && typeof tool.result === 'object' && 'pattern' in tool.result && typeof tool.result.pattern === 'string') {
    return `Searching for: ${tool.result.pattern}`;
  }
  
  // If we have args, create a meaningful description based on the tool type
  if (tool.args) {
    // For common tools, provide specialized descriptions - check both toolName and tool ID
    const toolInfo = (tool.toolName || '') + '|' + (tool.tool || '');
    
    // Search tools
    if (toolInfo.includes('Glob') || toolInfo.includes('glob')) {
      return `Searching for files: ${tool.args.pattern || 'files'}`;
    }
    if (toolInfo.includes('Grep') || toolInfo.includes('grep')) {
      return `Searching for content: ${tool.args.pattern || 'pattern'}`;
    }
    
    // Command tools
    if (toolInfo.includes('Bash') || toolInfo.includes('bash')) {
      return `Running command: ${truncateString(String(tool.args.command || 'command'), 80)}`;
    }
    
    // File reading tools
    if (toolInfo.includes('View') || toolInfo.includes('Read') || 
        toolInfo.includes('Cat') || toolInfo.includes('file_read')) {
      const path = tool.args.file_path || tool.args.path || tool.args.filePath;
      return path ? `Reading file: ${truncateString(String(path), 80)}` : `Reading file`;
    }
    
    // File editing tools
    if (toolInfo.includes('Edit') || toolInfo.includes('Write') || 
        toolInfo.includes('file_edit') || toolInfo.includes('file_write')) {
      const path = tool.args.file_path || tool.args.path || tool.args.filePath;
      return path ? `Editing file: ${truncateString(String(path), 80)}` : `Editing file`;
    }
    
    // Directory listing tools
    if (toolInfo.includes('LS') || toolInfo.includes('List') || toolInfo.includes('ls')) {
      const path = tool.args.path || tool.args.directory || '.';
      return `Listing files in: ${truncateString(String(path), 80)}`;
    }
    
    // Agent tools
    if (toolInfo.includes('Agent') || toolInfo.includes('agent')) {
      return `Running agent to: ${truncateString(String(tool.args.prompt || 'perform task'), 80)}`;
    }
    
    // Web tools
    if (toolInfo.includes('Web') || toolInfo.includes('Fetch') || 
        toolInfo.includes('web') || toolInfo.includes('fetch')) {
      return `Fetching content from: ${truncateString(String(tool.args.url || 'website'), 80)}`;
    }
    
    // Try to extract any useful parameter
    const argKeys = Object.keys(tool.args);
    if (argKeys.length > 0) {
      // Find the most meaningful parameter (not 'type', 'id', etc.)
      const meaningfulParams = argKeys.filter(k => 
        !['type', 'id', 'name', 'tool', 'timestamp'].includes(k.toLowerCase())
      );
      
      if (meaningfulParams.length > 0) {
        const param = meaningfulParams[0];
        const value = tool.args[param];
        return `${tool.toolName}: ${param} = ${truncateString(String(value), 60)}`;
      }
    }
    
    // For other tools, show a generic message with the tool name
    return `Running ${tool.toolName}`;
  }
  
  // Try to construct description from tool name and any available data
  if (tool.tool && tool.tool.includes('/')) {
    // If tool has a path-like structure, get the last part
    const toolName = tool.tool.split('/').pop() || tool.toolName;
    return `Running ${toolName}`;
  }
  
  // Fallback to a simple message with the tool name
  return `Running ${tool.toolName}`;
};

export interface ToolVisualizationProps {
  tool: ToolExecution;
  className?: string;
  compact?: boolean;
  showExecutionTime?: boolean;
  showExpandedParams?: boolean;
  onToggleExpand?: () => void;
  sessionId?: string;
  isDarkTheme?: boolean; // Add property to receive theme from parent
}

export function ToolVisualization({
  tool,
  className,
  compact = false,
  showExecutionTime = true,
  showExpandedParams = false,
  onToggleExpand,
  sessionId,
  isDarkTheme = false, // Default to light theme
}: ToolVisualizationProps) {
  // Directly convert tool status to ToolState without using internal state
  const toolState = 
    tool.status === 'running' ? ToolState.RUNNING :
    tool.status === 'completed' ? ToolState.COMPLETED :
    tool.status === 'error' ? ToolState.ERROR :
    tool.status === 'aborted' ? ToolState.ABORTED :
    tool.status === 'awaiting-permission' ? 'awaiting-permission' as any :
    ToolState.PENDING;
  // Use the toolState and isDarkTheme to determine styling
  const getStatusStyles = () => {
    const baseStyle = {
      [ToolState.RUNNING]: `border-blue-500 ${isDarkTheme ? 'bg-blue-900/30' : 'bg-blue-50'} shadow-sm`,
      [ToolState.COMPLETED]: `border-green-500 ${isDarkTheme ? 'bg-green-900/30' : 'bg-green-50'} shadow-sm`,
      [ToolState.ERROR]: `border-red-500 ${isDarkTheme ? 'bg-red-900/30' : 'bg-red-50'} shadow-sm`,
      [ToolState.ABORTED]: `border-gray-500 ${isDarkTheme ? 'bg-gray-800/20' : 'bg-gray-50'} opacity-75 tool-aborted`,
      'awaiting-permission': `border-amber-500 ${isDarkTheme ? 'bg-amber-900/30' : 'bg-amber-50'} shadow-sm`,
    };
    
    const currentState = toolState === ToolState.PENDING 
      ? (tool.status === 'awaiting-permission' ? 'awaiting-permission' : ToolState.RUNNING) 
      : toolState;
      
    return baseStyle[currentState];
  };
  
  const statusStyles = getStatusStyles();
  
  // Determine the status indicator text and style
  const statusIndicator = {
    [ToolState.RUNNING]: { icon: '●', ariaLabel: 'Running', className: 'text-blue-500 animate-pulse' },
    [ToolState.COMPLETED]: { icon: '✓', ariaLabel: 'Completed', className: 'text-green-500' },
    [ToolState.ERROR]: { icon: '✗', ariaLabel: 'Error', className: 'text-red-500' },
    [ToolState.ABORTED]: { icon: '■', ariaLabel: 'Aborted', className: 'text-gray-500' },
    'awaiting-permission': { icon: '?', ariaLabel: 'Waiting for permission', className: 'text-amber-500 animate-pulse' },
  }[toolState === ToolState.PENDING ? (tool.status === 'awaiting-permission' ? 'awaiting-permission' : ToolState.RUNNING) : toolState];
  
  // Format execution time if available
  const formattedTime = tool.executionTime 
    ? `${(tool.executionTime / 1000).toFixed(2)}s` 
    : 'In progress...';
  
  // Format timestamp
  const timestamp = new Date(tool.startTime).toLocaleTimeString();
  
  return (
    <div 
      className={cn(
        'tool-visualization border-l-4 px-1 py-0.5 my-0.5 rounded',
        'transition-colors duration-300 inline-block',
        statusStyles,
        // Use terminal's font size classes for relative sizing instead of fixed size
        'text-[0.8em]', // Make text slightly smaller than terminal text but scale with it
        className
      )}
      style={{ maxWidth: '30%', width: '300px' }} // Direct width constraint
      data-testid="tool-visualization"
      data-tool-id={tool.tool}
      data-tool-status={toolState}
      role="status"
      aria-live={toolState === ToolState.RUNNING ? 'polite' : 'off'}
      aria-label={`Tool ${tool.toolName} ${toolState}: ${getToolDescription(tool)}`}
    >
      {/* Simplified layout with tool name, description and status in a more compact form */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {/* Status indicator inline with name */}
          <span 
            className={statusIndicator.className}
            aria-label={statusIndicator.ariaLabel}
            role="status"
          >
            {statusIndicator.icon}
          </span>
          
          <span className="font-semibold">{tool.toolName}</span>
          
          {/* Execution time inline if available and enabled */}
          {showExecutionTime && tool.executionTime && (
            <span className={`${isDarkTheme ? 'text-gray-400' : 'text-gray-500'} ml-1`}>
              ({formattedTime})
            </span>
          )}
        </div>
      </div>
      
      {/* Parameters on same line when possible, with clear description */}
      <div 
        className={cn(
          'truncate',
          showExpandedParams ? 'whitespace-pre-wrap' : 'truncate'
        )}
        onClick={onToggleExpand}
        style={{ cursor: onToggleExpand ? 'pointer' : 'default' }}
      >
        {getToolDescription(tool)}
      </div>
      
      {/* Error message if status is error - keep this visible */}
      {toolState === ToolState.ERROR && tool.error && (
        <div className={isDarkTheme ? 'text-red-400' : 'text-red-600'}>
          {tool.error.message}
        </div>
      )}
      
      {/* Aborted message if status is aborted - keep this visible too */}
      {toolState === ToolState.ABORTED && (
        <div className={isDarkTheme ? 'text-gray-400' : 'text-gray-600'}>
          Operation aborted
        </div>
      )}
      
      {/* Permission request banner - more compact version */}
      {tool.status === 'awaiting-permission' && tool.requiresPermission && toolState !== ToolState.ABORTED && (
        <div 
          className={`mt-1 ${isDarkTheme ? 'bg-amber-900 text-amber-100 border-amber-700' : 'bg-amber-100 text-amber-800 border-amber-300'} px-2 py-1 rounded-md text-xs border`}
          data-testid="permission-banner"
        >
          <div className="font-semibold">Permission Required - Type 'y' to allow</div>
        </div>
      )}
      
      {/* Debug output - only visible in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className={`mt-2 p-2 text-xs border rounded font-mono ${
          isDarkTheme 
            ? 'bg-gray-800 border-gray-600' 
            : 'bg-gray-100 border-gray-300'
        }`}>
          <div>status: {tool.status}</div>
          <div>requiresPermission: {tool.requiresPermission ? 'true' : 'false'}</div>
          <div>permissionId: {tool.permissionId || 'none'}</div>
          <div>tool: {tool.tool}</div>
        </div>
      )}
    </div>
  );
}

export default ToolVisualization;