# Terminal UI Accessibility Features

The QCKFX Terminal UI is designed with accessibility in mind, implementing the following features. These features are powered by dedicated accessibility utilities in `src/ui/utils/accessibility/index.ts`.

## Keyboard Navigation

- Full keyboard navigation support
- Clearly defined tab order
- Visible focus indicators
- Keyboard shortcuts for common actions
- Focus management when dialogs open/close

## Screen Reader Support

- Proper ARIA roles and attributes
- Semantic HTML structure
- Descriptive labels for all interactive elements
- Live regions for dynamic content
- Announcements for important status changes
- Clear reading order

## Visual Accessibility

- High contrast text and UI elements
- Proper color contrast ratios
- Scalable text sizes
- Support for browser zoom
- Visible focus states
- Alternative visual indicators (not relying on color alone)

## Reduced Motion

- Respects the `prefers-reduced-motion` media query
- Alternative static presentation for animations
- Essential motion only
- No flashing or blinking content

## ARIA Attributes Used

- `role="application"` for the terminal container
- `role="log"` for the message feed area
- `role="textbox"` for the input field
- `role="toolbar"` for the terminal controls
- `role="dialog"` for modal dialogs
- `aria-live` regions for dynamic content
- `aria-label` for descriptive labels
- `aria-labelledby` for associating elements
- `aria-expanded` for disclosure widgets
- `aria-haspopup` for popup indicators

## Accessibility Utilities

The terminal uses the following accessibility utilities:

```typescript
// Generate unique IDs for ARIA attributes
generateAriaId(prefix: string): string

// Format keyboard combinations for screen readers
formatKeyCombo(combo: { key: string, ctrlKey?: boolean, ... }): string

// Check if user prefers reduced motion
prefersReducedMotion(): boolean

// Announce messages to screen readers
announceToScreenReader(message: string, assertive = false): void
```

## Testing

The terminal UI has been tested for accessibility with:
- Keyboard-only navigation
- VoiceOver screen reader
- High contrast mode
- Zoomed display
- Automated accessibility tests using axe

## Compliance Goals

The terminal UI aims to conform to:
- WCAG 2.1 Level AA standards
- Section 508 requirements
- WAI-ARIA 1.1 best practices

## Known Limitations

- Complex ANSI color output may not be fully described to screen readers
- Keyboard shortcuts may conflict with some screen reader commands
- Some advanced terminal features may require alternative accessible interfaces