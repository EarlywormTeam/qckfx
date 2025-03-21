import React, { useState, useRef, useEffect, KeyboardEvent, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputFieldProps {
  onSubmit: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  maxHistorySize?: number;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField({
  onSubmit,
  className,
  placeholder = 'Type a command...',
  disabled = false,
  autoFocus = true,
  maxHistorySize = 50
}: InputFieldProps, ref) {
  const [inputValue, setInputValue] = useState<string>('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number>(-1);
  const [tempValue, setTempValue] = useState<string>('');
  
  const innerInputRef = useRef<HTMLInputElement>(null);
  
  // Combine the refs
  const handleRef = (inputElement: HTMLInputElement) => {
    // Update the forwarded ref
    if (typeof ref === 'function') {
      ref(inputElement);
    } else if (ref) {
      // TypeScript complains about modifying a readonly property,
      // but this is how React's forwardRef pattern works
      (ref as React.MutableRefObject<HTMLInputElement | null>).current = inputElement;
    }
    
    // Update the inner ref
    (innerInputRef as React.MutableRefObject<HTMLInputElement | null>).current = inputElement;
  };

  // Focus input field on mount if autoFocus is true
  useEffect(() => {
    if (autoFocus && innerInputRef.current && !disabled) {
      innerInputRef.current.focus();
    }
  }, [autoFocus, disabled]);

  const handleSubmit = () => {
    if (!inputValue.trim() || disabled) return;
    
    onSubmit(inputValue);
    
    // Add to history (avoid duplicates at the end)
    if (history.length === 0 || history[history.length - 1] !== inputValue) {
      const newHistory = [...history, inputValue];
      // Keep history size limited
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
      }
      setHistory(newHistory);
    }
    
    setInputValue('');
    setHistoryCursor(-1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Handle arrow up/down for command history
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      
      if (historyCursor === -1) {
        // Save current input before navigating history
        setTempValue(inputValue);
      }
      
      if (history.length > 0 && historyCursor < history.length - 1) {
        const newCursor = historyCursor + 1;
        setHistoryCursor(newCursor);
        setInputValue(history[history.length - 1 - newCursor]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      
      if (historyCursor > 0) {
        const newCursor = historyCursor - 1;
        setHistoryCursor(newCursor);
        setInputValue(history[history.length - 1 - newCursor]);
      } else if (historyCursor === 0) {
        // Return to the original input value
        setHistoryCursor(-1);
        setInputValue(tempValue);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      // Clear input field on Escape
      setInputValue('');
      setHistoryCursor(-1);
    }
  };

  return (
    <div
      className={cn(
        'flex items-center border-t px-3 py-2 terminal-input',
        className
      )}
      style={{
        borderColor: 'var(--terminal-border)',
        backgroundColor: 'var(--terminal-input-bg)',
      }}
      data-testid="input-field-container"
    >
      <span 
        className="mr-2" 
        style={{ color: 'var(--terminal-prompt)' }}
      >
        $
      </span>
      <input
        ref={handleRef}
        className="flex-1 bg-transparent outline-none placeholder-gray-500"
        style={{ color: 'var(--terminal-text)' }}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        data-testid="input-field"
      />
      {disabled && (
        <span className="terminal-cursor" />
      )}
    </div>
  );
});

export default InputField;