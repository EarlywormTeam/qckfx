/**
 * Hook for handling keyboard shortcuts to abort agent operations
 */
import { useCallback, useEffect } from 'react';
import { useWebSocketTerminal } from '../context/WebSocketTerminalContext';
import { KeyboardShortcut } from './useKeyboardShortcuts';

/**
 * Custom hook to handle Ctrl+C and Esc keyboard shortcuts for aborting operations
 * 
 * @param enabled Whether the shortcuts should be active
 * @returns Object with abort shortcuts and abort function
 */
export function useAbortShortcuts(enabled: boolean = true) {
  const { isProcessing, abortProcessing } = useWebSocketTerminal();
  
  // Only enable shortcuts when processing is active
  const shortcutsEnabled = enabled && isProcessing;
  
  // Handle keydown event
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!shortcutsEnabled) return;

    // Get the target element
    const target = event.target as HTMLElement;
    const isInTextField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
    
    // Handle Ctrl+C - standard terminal cancel shortcut
    // Check that no text is selected to avoid interfering with copy operations
    const hasSelection = window.getSelection()?.toString() !== '';
    if (event.key === 'c' && event.ctrlKey && !hasSelection) {
      console.log('Aborting agent operation via Ctrl+C shortcut');
      event.preventDefault();
      abortProcessing();
      return;
    }
    
    // Handle Escape - if not in input field or if we're in an input but it's empty
    if (event.key === 'Escape') {
      // For input fields, only abort if the field is empty
      if (isInTextField) {
        const inputElement = target as HTMLInputElement;
        if (inputElement.value === '') {
          console.log('Aborting agent operation via Escape shortcut (from empty input)');
          event.preventDefault();
          abortProcessing();
        }
        // Otherwise let escape just clear the input (default behavior)
      } else {
        console.log('Aborting agent operation via Escape shortcut');
        event.preventDefault();
        abortProcessing();
      }
    }
  }, [shortcutsEnabled, abortProcessing]);
  
  // Attach and detach event listeners
  useEffect(() => {
    if (!enabled) return;
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
  
  // Create list of shortcuts for documentation
  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'c',
      ctrlKey: true,
      action: () => {
        if (isProcessing) {
          abortProcessing();
        }
      },
      description: 'Ctrl+C: Abort current operation',
    },
    {
      key: 'Escape',
      action: () => {
        if (isProcessing) {
          abortProcessing();
        }
      },
      description: 'Esc: Abort current operation (in empty fields)',
    }
  ];
  
  return {
    shortcuts,
    abortProcessing,
  };
}

export default useAbortShortcuts;