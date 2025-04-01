import { useEffect, useCallback } from 'react';
import { useToolStream } from './useToolStream';
import { useWebSocket } from './useWebSocket';

/**
 * Hook for handling keyboard events for permission requests
 */
export function usePermissionKeyboardHandler({
  sessionId,
}: {
  sessionId?: string;
}) {
  const { getActiveTools } = useToolStream();
  const { socket } = useWebSocket();
  
  // Get pending permissions from active tools
  const pendingPermissions = getActiveTools()
    .filter(tool => tool.status === 'awaiting-permission' && tool.permissionId)
    .map(tool => ({
      id: tool.permissionId!,
      toolId: tool.tool,
      toolName: tool.toolName,
      executionId: tool.id
    }));
  
  // Resolve permission on the server
  const resolvePermission = useCallback((permissionId: string, granted: boolean) => {
    if (!socket || !sessionId) {
      console.error('Cannot resolve permission: no socket or session ID');
      return Promise.reject(new Error('No socket or session ID'));
    }
    
    return new Promise<boolean>((resolve) => {
      // Emit permission resolution event to server
      socket.emit('resolve_permission', {
        sessionId,
        permissionId,
        granted
      }, (response: { success: boolean }) => {
        resolve(response.success);
      });
    });
  }, [socket, sessionId]);

  // Handle keyboard events for permission requests
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!pendingPermissions.length) return;
      
      // Prevent default behavior for y/n keys in this context
      if (event.key.toLowerCase() === 'y' || event.key.length === 1) {
        event.preventDefault();
      }
      
      console.log('Keyboard event with pending permissions:', { 
        key: event.key, 
        pendingCount: pendingPermissions.length 
      });
      
      // Get the first pending permission
      const permission = pendingPermissions[0];
      
      // If 'y' is pressed, grant permission
      if (event.key.toLowerCase() === 'y') {
        console.log('Granting permission for', permission.id);
        resolvePermission(permission.id, true)
          .then((success) => {
            console.log(`Permission granted for ${permission.toolId}, success: ${success}`);
          })
          .catch(err => {
            console.error('Error in permission grant:', err);
          });
      } 
      // For any other key, deny permission
      else if (event.key.length === 1) { // Only handle printable characters
        console.log('Denying permission for', permission.id);
        resolvePermission(permission.id, false)
          .then((success) => {
            console.log(`Permission denied for ${permission.toolId}, success: ${success}`);
          })
          .catch(err => {
            console.error('Error in permission denial:', err);
          });
      }
    },
    [pendingPermissions, resolvePermission]
  );

  // Set up the key event listener
  useEffect(() => {
    // Only add listener if there are pending permissions
    if (pendingPermissions.length > 0) {
      console.log('🔑 Adding keyboard handler for permissions', { 
        pendingCount: pendingPermissions.length
      });
      
      // Use capture phase to ensure our handler runs before others
      window.addEventListener('keydown', handleKeyDown, true);
      
      return () => {
        console.log('🔑 Removing keyboard handler for permissions');
        window.removeEventListener('keydown', handleKeyDown, true);
      };
    }
  }, [pendingPermissions, handleKeyDown]);

  return {
    hasPendingPermissions: pendingPermissions.length > 0,
  };
}

export default usePermissionKeyboardHandler;