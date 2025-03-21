/**
 * Error handling middleware
 */
import { Request, Response, NextFunction } from 'express';
import { ApiError, ServerError } from '../utils/errors';
import { serverLogger } from '../logger';
import { isDevelopmentMode } from '..';

/**
 * Format error response according to our API standards
 */
function formatErrorResponse(error: ApiError) {
  return {
    error: {
      code: error.errorCode || 'UNKNOWN_ERROR',
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  };
}

/**
 * Error handling middleware for API routes
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the error
  serverLogger.error('API Error:', err);

  // If the error is one of our API errors, use its status code
  if (err instanceof ApiError) {
    res.status(err.statusCode).json(formatErrorResponse(err));
    return;
  }

  // For unknown errors, return a 500
  const serverError = new ServerError(
    !isDevelopmentMode() 
      ? 'Internal server error'
      : err.message || 'Internal server error',
    !isDevelopmentMode() ? undefined : err
  );

  res.status(serverError.statusCode).json(formatErrorResponse(serverError));
}

/**
 * Handle 404 Not Found errors
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`, 'NOT_FOUND');
  next(error);
}