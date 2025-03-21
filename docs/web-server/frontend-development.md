# Frontend Development Guide

This guide provides an overview of the frontend architecture and development workflow for the qckfx web interface.

## Tech Stack

- **React**: UI library
- **TypeScript**: For type-safe code
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Component collection built on Tailwind CSS

## Directory Structure

```
src/ui/
├── components/     # UI components
│   └── ui/         # Base UI components from shadcn
├── hooks/          # Custom React hooks
├── pages/          # Page components
├── services/       # API client and services
├── styles/         # Global styles and Tailwind config
├── types/          # TypeScript type definitions
├── lib/            # Utility functions
├── App.tsx         # Main application component
└── main.tsx        # Entry point
```

## Development Workflow

### Starting the Development Server

```bash
# Start the backend server
npm run start:dist

# In another terminal, start the frontend dev server
npm run dev:ui
```

This will start the Vite development server at http://localhost:5173, which will proxy API requests to the backend server running at http://localhost:3000.

### Building for Production

```bash
npm run build
```

This builds both the backend and frontend for production. The frontend assets will be placed in the `dist/ui` directory.

### Testing

```bash
# Run all frontend tests
npm run test:ui

# Watch mode for development
npm run test:ui:watch

# Run with coverage report
npm run test:ui:coverage
```

## API Integration

The frontend communicates with the backend through:

1. **REST API**: For operation-based actions like starting sessions and querying
2. **WebSockets**: For real-time updates like thinking status and tool calls

All API interaction is done through the `apiClient` service in `src/ui/services/apiClient.ts`.

## Theme System

The application supports light and dark modes using Tailwind CSS's dark mode feature. The theme can be toggled using the ThemeToggle component, and the current theme is stored in localStorage.

## Adding UI Components

UI components are built using shadcn/ui, which provides a collection of accessible, customizable components built on Tailwind CSS.

To add a new shadcn/ui component:

```bash
npm run ui:generate button
```

See the [shadcn/ui documentation](https://ui.shadcn.com) for more information.