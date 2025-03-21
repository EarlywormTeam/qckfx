# Web UI Development

The agent includes a web UI that provides a browser-based interface for interacting with the agent.

## Architecture

The web UI consists of two main components:

1. An Express server that serves the web UI and provides API endpoints
2. A React-based frontend for user interaction

## Server

The server is implemented in `src/server/` and includes:

- Express server setup with middleware for CORS, JSON parsing, etc.
- API endpoints for interacting with the agent
- Static file serving for the frontend

## Configuration

The web UI can be configured using command-line options or environment variables:

### Command-line Options

- `--web` - Enable the web UI (default: true)
- `--no-web` - Disable the web UI
- `--port <port>` - Specify the port for the web UI (default: 3000)

### Environment Variables

- `QCKFX_DISABLE_WEB=true` - Disable the web UI
- `QCKFX_PORT=<port>` - Specify the port for the web UI
- `QCKFX_HOST=<host>` - Specify the host to bind to (default: localhost)

## Development

### Running the Server

The server is automatically started when you run the agent. To start the agent for development:

```bash
npm run dev
```

### Building the Frontend

The frontend is built using Vite. To build the frontend:

```bash
# Command will be updated once the frontend is implemented
# npm run build:ui
```

### Testing

The server includes unit tests. To run the tests:

```bash
npm run test
```