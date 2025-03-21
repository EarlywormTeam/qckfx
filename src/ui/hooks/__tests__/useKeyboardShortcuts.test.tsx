import React, { useRef } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { useKeyboardShortcuts, KeyboardShortcut } from '../useKeyboardShortcuts';
import { vi } from 'vitest';

// Test component that uses the hook
const TestComponent = ({ 
  shortcuts,
  enabled = true,
  targetRef = false,
}: { 
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
  targetRef?: boolean;
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  
  useKeyboardShortcuts({
    shortcuts,
    enabled,
    targetRef: targetRef ? divRef : undefined,
  });
  
  return (
    <div>
      <div ref={divRef} data-testid="test-element" tabIndex={0}>Test Element</div>
      <input data-testid="test-input" />
    </div>
  );
};

describe('useKeyboardShortcuts Hook', () => {
  it('triggers action when shortcut is pressed on document', () => {
    const mockAction = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      {
        key: 'a',
        action: mockAction,
        description: 'Test Action',
      },
    ];
    
    render(<TestComponent shortcuts={shortcuts} />);
    
    // Trigger the shortcut on the document
    fireEvent.keyDown(document, { key: 'a' });
    
    expect(mockAction).toHaveBeenCalledTimes(1);
  });
  
  it('triggers action when shortcut with modifier keys is pressed', () => {
    const mockAction = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      {
        key: 'a',
        ctrlKey: true,
        action: mockAction,
        description: 'Ctrl+A Action',
      },
    ];
    
    render(<TestComponent shortcuts={shortcuts} />);
    
    // Trigger the shortcut without Ctrl - should not call action
    fireEvent.keyDown(document, { key: 'a' });
    expect(mockAction).not.toHaveBeenCalled();
    
    // Trigger with Ctrl - should call action
    fireEvent.keyDown(document, { key: 'a', ctrlKey: true });
    expect(mockAction).toHaveBeenCalledTimes(1);
  });
  
  it('does not trigger when enabled is false', () => {
    const mockAction = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      {
        key: 'a',
        action: mockAction,
        description: 'Test Action',
      },
    ];
    
    render(<TestComponent shortcuts={shortcuts} enabled={false} />);
    
    // Trigger the shortcut
    fireEvent.keyDown(document, { key: 'a' });
    
    expect(mockAction).not.toHaveBeenCalled();
  });
  
  it('targets specific element when targetRef is provided', () => {
    const mockAction = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      {
        key: 'a',
        action: mockAction,
        description: 'Test Action',
      },
    ];
    
    const { getByTestId } = render(
      <TestComponent shortcuts={shortcuts} targetRef={true} />
    );
    
    const targetElement = getByTestId('test-element');
    const otherElement = getByTestId('test-input');
    
    // Trigger on target element - should call action
    fireEvent.keyDown(targetElement, { key: 'a' });
    expect(mockAction).toHaveBeenCalledTimes(1);
    
    // Reset mock
    mockAction.mockReset();
    
    // Trigger on other element - should not call action
    fireEvent.keyDown(otherElement, { key: 'a' });
    expect(mockAction).not.toHaveBeenCalled();
  });
  
  it('ignores case when matching shortcuts', () => {
    const mockAction = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      {
        key: 'a',
        action: mockAction,
        description: 'Test Action',
      },
    ];
    
    render(<TestComponent shortcuts={shortcuts} />);
    
    // Trigger with uppercase A
    fireEvent.keyDown(document, { key: 'A' });
    
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it('skips regular key shortcuts in input fields', () => {
    const mockAction = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      {
        key: 'a',
        action: mockAction,
        description: 'Regular Key Action',
      },
    ];
    
    const { getByTestId } = render(<TestComponent shortcuts={shortcuts} />);
    const inputElement = getByTestId('test-input');
    
    // Set focus to input and trigger the shortcut
    inputElement.focus();
    fireEvent.keyDown(inputElement, { key: 'a' });
    
    // Should not trigger the action when in input field
    expect(mockAction).not.toHaveBeenCalled();
  });

  it('allows special key combinations in input fields', () => {
    const mockAction = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      {
        key: 'l',
        ctrlKey: true,
        action: mockAction,
        description: 'Ctrl+L Action',
      },
      {
        key: '?',
        action: vi.fn(),
        description: 'Question Mark Action',
      },
    ];
    
    const { getByTestId } = render(<TestComponent shortcuts={shortcuts} />);
    const inputElement = getByTestId('test-input');
    
    // Set focus to input and trigger the Ctrl+L shortcut
    inputElement.focus();
    fireEvent.keyDown(inputElement, { key: 'l', ctrlKey: true });
    
    // Should trigger the action even in input field because it's a special combination
    expect(mockAction).toHaveBeenCalledTimes(1);
  });
});