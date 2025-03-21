# Terminal UI Theme Customization

The QCKFX Terminal UI supports theme customization to match user preferences:

## Color Schemes

The terminal supports two color schemes:

### Dark Theme (Default)
- Dark backgrounds with light text
- High contrast for readability
- Suitable for low-light environments
- Terminal-like aesthetic

### Light Theme
- Light backgrounds with dark text
- Reduced eye strain in bright environments
- Still maintains the terminal aesthetic

## Font Customization

### Font Families
The terminal supports various monospace font families:
- Monospace (default)
- Courier New
- Fira Code (if installed)
- IBM Plex Mono (if installed)
- Roboto Mono (if installed)

### Font Sizes
Available font size options:
- Extra Small (xs)
- Small (sm)
- Medium (md) - default
- Large (lg)
- Extra Large (xl)

## How to Customize

1. Click the settings gear icon (⚙️) in the terminal header
2. Select desired font family, font size, and color scheme
3. See a live preview of your changes
4. Click "Save" to apply the changes

## CSS Variables

The terminal uses CSS variables for theming, which can be customized for advanced users:

### Dark Theme Variables
```css
.theme-dark {
  --terminal-background-color: #0e1117;
  --terminal-text-color: #d9d9d9;
  --terminal-border-color: #2a2e37;
  --terminal-header-color: #181c24;
  --terminal-input-bg-color: #171a21;
  --terminal-prompt-color: #5ccfe6;

  --terminal-user-msg-bg-color: #1e3a8a;
  --terminal-user-msg-text-color: #e2e8f0;
  --terminal-assistant-msg-bg-color: #1f2937;
  --terminal-assistant-msg-text-color: #e2e8f0;
  --terminal-system-msg-bg-color: #3b4252;
  --terminal-system-msg-text-color: #d8dee9;
  --terminal-error-msg-bg-color: #7f1d1d;
  --terminal-error-msg-text-color: #fecaca;
  --terminal-tool-msg-bg-color: #1e293b;
  --terminal-tool-msg-text-color: #d8dee9;
}
```

### Light Theme Variables
```css
.theme-light {
  --terminal-background-color: #f8f9fa;
  --terminal-text-color: #1a1a1a;
  --terminal-border-color: #d1d5db;
  --terminal-header-color: #e9ecef;
  --terminal-input-bg-color: #f1f3f5;
  --terminal-prompt-color: #0284c7;

  --terminal-user-msg-bg-color: #dbeafe;
  --terminal-user-msg-text-color: #1e3a8a;
  --terminal-assistant-msg-bg-color: #f3f4f6;
  --terminal-assistant-msg-text-color: #111827;
  --terminal-system-msg-bg-color: #e5e7eb;
  --terminal-system-msg-text-color: #374151;
  --terminal-error-msg-bg-color: #fee2e2;
  --terminal-error-msg-text-color: #7f1d1d;
  --terminal-tool-msg-bg-color: #f1f5f9;
  --terminal-tool-msg-text-color: #0f172a;
}
```

## Future Enhancements

Planned enhancements for theming:
- Custom color selection for individual elements
- Theme presets (cyberpunk, retro, minimal, etc.)
- User-defined theme export/import
- System theme detection and auto-switching