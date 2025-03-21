import React from 'react';
import { KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';
import { cn } from '@/lib/utils';

export interface ShortcutsPanelProps {
  shortcuts: KeyboardShortcut[];
  isOpen: boolean;
  onClose: () => void;
  className?: string;
  ariaLabelledBy?: string;
}

function formatKey(shortcut: KeyboardShortcut): string {
  const keys = [];
  
  if (shortcut.ctrlKey) keys.push('Ctrl');
  if (shortcut.altKey) keys.push('Alt');
  if (shortcut.shiftKey) keys.push('Shift');
  if (shortcut.metaKey) keys.push('Cmd');
  
  // Use lowercase for 'k' and 'h', uppercase for others
  const key = shortcut.key;
  if (key === 'k' || key === 'h') {
    keys.push(key.toLowerCase());
  } else {
    keys.push(key.toUpperCase());
  }
  
  return keys.join(' + ');
}

export function ShortcutsPanel({
  shortcuts,
  isOpen,
  onClose,
  className,
  ariaLabelledBy,
}: ShortcutsPanelProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'bg-gray-900 border border-gray-700 rounded-lg shadow-lg p-6 max-w-md w-full',
          className
        )}
        data-testid="shortcuts-panel"
        role="document"
        aria-labelledby={ariaLabelledBy}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white" id={ariaLabelledBy}>Keyboard Shortcuts</h2>
          <button
            className="text-gray-400 hover:text-white"
            onClick={onClose}
            aria-label="Close shortcuts panel"
            data-testid="close-shortcuts"
          >
            &times;
          </button>
        </div>
        
        <div className="space-y-1">
          {shortcuts.length === 0 ? (
            <p className="text-gray-400">No shortcuts available</p>
          ) : (
            shortcuts.map((shortcut, index) => (
              <div
                key={index}
                className="flex justify-between py-2 border-b border-gray-800 last:border-0"
              >
                <span className="text-gray-300">{shortcut.description}</span>
                <kbd className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300 font-mono">
                  {formatKey(shortcut)}
                </kbd>
              </div>
            ))
          )}
        </div>
        
        <div className="mt-4 text-xs text-gray-500 text-center">
          Press Cmd+h (macOS) or Ctrl+h (Windows/Linux) to toggle this panel
        </div>
      </div>
    </div>
  );
}

export default ShortcutsPanel;