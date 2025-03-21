# Terminal UI Message Types

The QCKFX Terminal UI supports several message types to provide a rich interactive experience:

## User Messages
Messages sent by the user:
- Display on the right side of the terminal
- Shown with a distinct blue background
- Include the timestamp of the message

## Assistant Messages
Responses from the AI assistant:
- Display on the left side of the terminal
- Shown with a dark gray background
- Support ANSI color codes for rich text formatting
- Include the timestamp of the message

## System Messages
Notifications and status updates from the system:
- Display centered in the terminal
- Shown with a medium gray background
- Use a slightly smaller and italic font style
- Include the timestamp of the message

## Error Messages
Error notifications:
- Display centered in the terminal
- Shown with a red background
- Announced to screen readers as alerts
- Include the timestamp of the message

## Tool Messages
Output from tool executions:
- Display on the left side of the terminal
- Shown with a monospace font and gray background
- Support ANSI color codes for terminal-like output
- Include the timestamp of the message

## ANSI Color Support

The terminal supports ANSI color codes in assistant and tool messages, allowing for rich formatting:

- Basic colors (red, green, blue, etc.)
- Text styles (bold, italic, underline)
- Color resets

Example of colored output:
```
This is \u001b[31mred text\u001b[0m and this is \u001b[32mgreen text\u001b[0m.
```

Renders as "This is **red text** and this is **green text**" with appropriate colors.

## Message Delivery

Messages appear with a subtle animation by default:
- Fade-in effect for smooth appearance
- Automatic scrolling to show new messages
- Reduced motion option for users who prefer minimal animations

## Future Enhancements

Planned enhancements for messages:
- Expandable/collapsible long messages
- Message grouping for related content
- Image and rich media support
- Interactive message components