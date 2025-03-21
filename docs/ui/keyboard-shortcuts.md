# Terminal UI Keyboard Shortcuts

The QCKFX Terminal UI supports the following keyboard shortcuts for efficient interaction:

## Global Shortcuts

| Shortcut | Description |
|----------|-------------|
| `Cmd + h` | Toggle shortcuts panel (macOS) |
| `Ctrl + h` | Toggle shortcuts panel (Windows/Linux) |
| `Cmd + ,` | Open settings panel (macOS) |
| `Ctrl + ,` | Open settings panel (Windows/Linux) |
| `Cmd + k` | Clear terminal (macOS) |
| `Ctrl + k` | Clear terminal (Windows/Linux) |
| `Cmd + /` | Focus command input (macOS) |
| `Ctrl + /` | Focus command input (Windows/Linux) |

## Input Field Shortcuts

| Shortcut | Description |
|----------|-------------|
| `Up Arrow` | Navigate command history (previous command) |
| `Down Arrow` | Navigate command history (next command) |
| `Enter` | Submit command |
| `Escape` | Clear current input |

## Implementation

These shortcuts are implemented using the `useKeyboardShortcuts` custom hook, which provides a flexible way to define keyboard shortcuts with the following features:

```typescript
interface KeyboardShortcut {
  key: string;          // The key to listen for
  ctrlKey?: boolean;    // Whether the Ctrl key should be pressed
  altKey?: boolean;     // Whether the Alt key should be pressed
  shiftKey?: boolean;   // Whether the Shift key should be pressed
  metaKey?: boolean;    // Whether the Meta/Command key should be pressed
  action: () => void;   // Function to execute when the shortcut is triggered
  description: string;  // Human-readable description of the shortcut
}
```

## How Keyboard Shortcuts Work

The Terminal UI implements a robust keyboard shortcut system:

1. **Global Availability**: Keyboard shortcuts work throughout the application, regardless of which component has focus
2. **Input Field Compatibility**: 
   - When typing in the input field, single-key shortcuts are temporarily disabled to avoid interfering with text input
   - Special key combinations (like `Cmd+k` and `Cmd+h`) remain active even when typing
3. **Focus Management**: Shortcuts like `Cmd+/` help users quickly navigate between different parts of the terminal

## Usage Tips

1. Use `Cmd + k` (macOS) or `Ctrl + k` (Windows/Linux) to quickly clear the terminal when it gets cluttered.
2. Use arrow keys to recall previous commands instead of retyping them.
3. Press `Cmd + h` (macOS) or `Ctrl + h` (Windows/Linux) to see this list of shortcuts.
4. Use `Cmd + /` (macOS) or `Ctrl + /` (Windows/Linux) to quickly focus the input field.

## Accessibility Considerations

All keyboard shortcuts are designed to work well with screen readers and other assistive technologies:

- Shortcuts are announced to screen readers when the shortcuts panel is opened
- All interactive elements are properly labelled for screen reader users
- Keyboard focus is managed to provide a smooth navigation experience
- Modifier keys (Cmd/Ctrl, Alt, etc.) are properly handled and announced

## Custom Shortcuts

In a future release, users will be able to customize these keyboard shortcuts through the settings panel.