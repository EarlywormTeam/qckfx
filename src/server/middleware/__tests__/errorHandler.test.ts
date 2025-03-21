/**
 * Error handler middleware tests
 */
import { Request, Response, NextFunction } from 'express';
import { errorHandler, notFoundHandler } from '../errorHandler';
import { ApiError, ValidationError, ServerError } from '../../utils/errors';

// Mock serverLogger
jest.mock('../../logger', () => ({
  serverLogger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Error Handling Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    nextFunction = jest.fn();
  });

  describe('errorHandler', () => {
    it('should handle ApiError properly', () => {
      const error = new ApiError(400, 'Bad request', 'BAD_REQUEST', { field: 'value' });
      
      errorHandler(
        error, 
        mockRequest as Request, 
        mockResponse as Response, 
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'BAD_REQUEST',
          message: 'Bad request',
          details: { field: 'value' },
        },
      });
    });

    it('should convert unknown errors to ServerError', () => {
      const error = new Error('Unknown error');
      
      errorHandler(
        error, 
        mockRequest as Request, 
        mockResponse as Response, 
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'SERVER_ERROR',
          message: expect.any(String),
        }),
      }));
    });
  });

  describe('notFoundHandler', () => {
    it('should create a NOT_FOUND error and pass it to next', () => {
      mockRequest = {
        method: 'GET',
        originalUrl: '/api/nonexistent',
      };
      
      notFoundHandler(
        mockRequest as Request, 
        mockResponse as Response, 
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          errorCode: 'NOT_FOUND',
        })
      );
    });
  });
});