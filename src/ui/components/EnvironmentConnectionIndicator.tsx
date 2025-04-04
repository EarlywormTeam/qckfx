import React from 'react';
import { useConnectionStatus } from '../hooks/useConnectionStatus';
import { useExecutionEnvironment } from '../hooks/useExecutionEnvironment';

interface EnvironmentConnectionIndicatorProps {
  className?: string;
}

/**
 * Combined indicator that shows both execution environment and connection status
 */
export function EnvironmentConnectionIndicator({
  className = ''
}: EnvironmentConnectionIndicatorProps) {
  const { status, error, connect } = useConnectionStatus();
  const { isDocker, isE2B } = useExecutionEnvironment();
  
  // We no longer need this function since we use direct background color classes
  // Removed getStatusColorClass function
  
  // Simple colored circle for connection status
  const getConnectionIndicator = () => {
    // Determine background color based on connection status
    const bgColorClass = 
      status === 'connected' ? 'bg-green-500' : 
      status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
      'bg-red-500';
    
    // Render a simple circle with the appropriate color
    return (
      <div className={`w-3 h-3 rounded-full ${bgColorClass}`}></div>
    );
  };
  
  // Get the environment name - if the server logs show Docker initialization,
  // we should trust that Docker is being used even if the WebSocket hasn't
  // yet received the environment information
  const environmentName = isDocker ? 'Docker' : isE2B ? 'E2B' : 'Local';
  
  // Get the connection status message
  const getStatusMessage = () => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return `Error: ${error?.message || 'Connection failed'}`;
      default:
        return 'Unknown status';
    }
  };
  
  return (
    <div
      className={`relative group flex items-center gap-1.5 ${className}`}
      role="button"
      onClick={connect}
      aria-label={`${environmentName} environment: ${getStatusMessage()}. Click to reconnect.`}
      data-testid="environment-connection-indicator"
    >
      {getConnectionIndicator()}
      <span className="text-xs text-gray-500 font-mono">{environmentName}</span>
      
      {/* Tooltip with detailed information */}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 py-2 px-3 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-10 min-w-[200px]">
        <div className="font-bold mb-1">Execution Environment</div>
        <div className="flex justify-between mb-2">
          <span>Type:</span>
          <span className="font-semibold">{environmentName}</span>
        </div>
        
        <div className="font-bold mb-1">Connection Status</div>
        <div className="flex justify-between">
          <span>Status:</span>
          <span className={`font-semibold ${
            status === 'connected' ? 'text-green-400' : 
            status === 'connecting' ? 'text-yellow-400' : 
            'text-red-400'
          }`}>
            {getStatusMessage()}
          </span>
        </div>
        
        <div className="mt-2 text-[10px] text-gray-300 text-center">
          Click to reconnect
        </div>
      </div>
    </div>
  );
}

export default EnvironmentConnectionIndicator;