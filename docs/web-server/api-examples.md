# API Usage Examples

This document provides examples of how to use the API endpoints.

## Starting a Session

```javascript
// Using fetch
const response = await fetch('http://localhost:3000/api/start', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    config: {
      model: 'claude-3-7-sonnet-20250219',
    },
  }),
});

const data = await response.json();
console.log('Session created:', data);
// { sessionId: '123e4567-e89b-12d3-a456-426614174000', ... }
```

## Submitting a Query

```javascript
const response = await fetch('http://localhost:3000/api/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    sessionId: '123e4567-e89b-12d3-a456-426614174000',
    query: 'Hello, how can you help me?',
  }),
});

const data = await response.json();
console.log('Query submitted:', data);
// { accepted: true, sessionId: '123e4567-e89b-12d3-a456-426614174000', ... }
```

## Getting Session Status

```javascript
const response = await fetch('http://localhost:3000/api/status?sessionId=123e4567-e89b-12d3-a456-426614174000');
const data = await response.json();
console.log('Session status:', data);
// { sessionId: '123e4567-e89b-12d3-a456-426614174000', isProcessing: false, ... }
```

## Getting Conversation History

```javascript
const response = await fetch('http://localhost:3000/api/history?sessionId=123e4567-e89b-12d3-a456-426614174000');
const data = await response.json();
console.log('Conversation history:', data);
// { sessionId: '123e4567-e89b-12d3-a456-426614174000', history: [...] }
```

## Aborting an Operation

```javascript
const response = await fetch('http://localhost:3000/api/abort', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    sessionId: '123e4567-e89b-12d3-a456-426614174000',
  }),
});

const data = await response.json();
console.log('Operation aborted:', data);
// { success: true, sessionId: '123e4567-e89b-12d3-a456-426614174000', ... }
```

## Getting Permission Requests

```javascript
const response = await fetch('http://localhost:3000/api/permissions?sessionId=123e4567-e89b-12d3-a456-426614174000');
const data = await response.json();
console.log('Permission requests:', data);
// { sessionId: '123e4567-e89b-12d3-a456-426614174000', permissions: [...] }
```

## Resolving a Permission Request

```javascript
const response = await fetch('http://localhost:3000/api/permissions/resolve', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    sessionId: '123e4567-e89b-12d3-a456-426614174000',
    permissionId: 'permission-123',
    granted: true,
  }),
});

const data = await response.json();
console.log('Permission resolved:', data);
// { success: true, sessionId: '123e4567-e89b-12d3-a456-426614174000', permissionId: 'permission-123', ... }
```

## WebSocket Connection

```javascript
// Using socket.io-client
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

// Join a session
socket.emit('join_session', '123e4567-e89b-12d3-a456-426614174000');

// Listen for events
socket.on('processing_started', (data) => {
  console.log('Processing started:', data);
});

socket.on('processing_completed', (data) => {
  console.log('Processing completed:', data);
  console.log('Response:', data.result);
});

socket.on('tool_execution', (data) => {
  console.log('Tool executed:', data.tool);
  console.log('Result:', data.result);
});

socket.on('permission_requested', (data) => {
  console.log('Permission requested:', data.permission);
});

socket.on('processing_error', (data) => {
  console.error('Processing error:', data.error);
});

socket.on('session_updated', (session) => {
  console.log('Session updated:', session);
});

// Leave a session
socket.emit('leave_session', '123e4567-e89b-12d3-a456-426614174000');

// Disconnect
socket.disconnect();
```

## Accessing API Documentation

The API documentation is available in two formats:

1. JSON format: `GET /api/docs`
2. Interactive UI: `GET /api-docs`

The interactive UI provides a user-friendly interface to explore and test the API endpoints.