/**
 * Error types for the server
 */

/**
 * Base error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public errorCode?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Error for invalid request data
 */
export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(400, message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * Error for when a resource is not found
 */
export class NotFoundError extends ApiError {
  constructor(message: string) {
    super(404, message, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/**
 * Error for unauthorized access
 */
export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

/**
 * Error for server-side issues
 */
export class ServerError extends ApiError {
  constructor(message = 'Internal server error', details?: unknown) {
    super(500, message, 'SERVER_ERROR', details);
    this.name = 'ServerError';
  }
}

/**
 * Error for when the agent is busy
 */
export class AgentBusyError extends ApiError {
  constructor(message = 'Agent is currently busy with another operation') {
    super(409, message, 'AGENT_BUSY');
    this.name = 'AgentBusyError';
  }
}

/**
 * Error for when a session is not found
 */
export class SessionNotFoundError extends NotFoundError {
  constructor(sessionId: string) {
    super(`Session with ID ${sessionId} not found`);
    this.name = 'SessionNotFoundError';
  }
}

/**
 * Error for when a request times out
 */
export class TimeoutError extends ApiError {
  constructor(message = 'Request timed out') {
    super(408, message, 'TIMEOUT');
    this.name = 'TimeoutError';
  }
}