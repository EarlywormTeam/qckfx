import React, { useState } from 'react';
import { ToolVisualization } from './ToolVisualization';
import { ToolExecution } from '../../hooks/useToolStream';
import { cn } from '../../lib/utils';

export interface ToolVisualizationsProps {
  tools: ToolExecution[];
  className?: string;
  maxVisible?: number;
  compact?: boolean;
  sessionId?: string;
}

export function ToolVisualizations({
  tools,
  className,
  maxVisible = 3,
  compact = false,
  sessionId,
}: ToolVisualizationsProps) {
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  
  // Show only the first maxVisible tools if there are more
  const visibleTools = tools.slice(0, maxVisible);
  const hiddenCount = Math.max(0, tools.length - maxVisible);
  
  const toggleExpand = (toolId: string) => {
    setExpandedTools(prev => ({
      ...prev,
      [toolId]: !prev[toolId],
    }));
  };
  
  return (
    <div 
      className={cn('tool-visualizations', className)}
      data-testid="tool-visualizations"
      aria-label={`Tool executions: ${tools.length} tools`}
    >
      {visibleTools.map(tool => (
        <ToolVisualization
          key={tool.id}
          tool={tool}
          compact={compact}
          showExpandedParams={expandedTools[tool.id]}
          onToggleExpand={() => toggleExpand(tool.id)}
          sessionId={sessionId}
        />
      ))}
      
      {hiddenCount > 0 && (
        <div className="text-xs text-center text-gray-500 mt-1">
          +{hiddenCount} more tool executions
        </div>
      )}
      
      {tools.length === 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400 italic">
          No active tools
        </div>
      )}
    </div>
  );
}

export default ToolVisualizations;