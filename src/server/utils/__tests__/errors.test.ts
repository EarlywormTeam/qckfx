/**
 * Error types tests
 */
import {
  ApiError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ServerError,
  AgentBusyError,
  SessionNotFoundError,
  TimeoutError,
} from '../errors';

describe('Error Types', () => {
  describe('ApiError', () => {
    it('should create an ApiError with the correct properties', () => {
      const error = new ApiError(400, 'Bad request', 'BAD_REQUEST', { field: 'value' });
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Bad request');
      expect(error.errorCode).toBe('BAD_REQUEST');
      expect(error.details).toEqual({ field: 'value' });
      expect(error.name).toBe('ApiError');
    });
  });

  describe('ValidationError', () => {
    it('should create a ValidationError with the correct properties', () => {
      const error = new ValidationError('Invalid data', { field: 'Invalid value' });
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid data');
      expect(error.errorCode).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual({ field: 'Invalid value' });
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('NotFoundError', () => {
    it('should create a NotFoundError with the correct properties', () => {
      const error = new NotFoundError('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Resource not found');
      expect(error.errorCode).toBe('NOT_FOUND');
      expect(error.name).toBe('NotFoundError');
    });
  });

  describe('UnauthorizedError', () => {
    it('should create an UnauthorizedError with the correct properties', () => {
      const error = new UnauthorizedError();
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Unauthorized');
      expect(error.errorCode).toBe('UNAUTHORIZED');
      expect(error.name).toBe('UnauthorizedError');
    });

    it('should allow custom message', () => {
      const error = new UnauthorizedError('Custom unauthorized message');
      expect(error.message).toBe('Custom unauthorized message');
    });
  });

  describe('ServerError', () => {
    it('should create a ServerError with the correct properties', () => {
      const error = new ServerError();
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Internal server error');
      expect(error.errorCode).toBe('SERVER_ERROR');
      expect(error.name).toBe('ServerError');
    });

    it('should allow custom message and details', () => {
      const details = { error: 'Database connection failed' };
      const error = new ServerError('Custom server error', details);
      expect(error.message).toBe('Custom server error');
      expect(error.details).toEqual(details);
    });
  });

  describe('AgentBusyError', () => {
    it('should create an AgentBusyError with the correct properties', () => {
      const error = new AgentBusyError();
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Agent is currently busy with another operation');
      expect(error.errorCode).toBe('AGENT_BUSY');
      expect(error.name).toBe('AgentBusyError');
    });

    it('should allow custom message', () => {
      const error = new AgentBusyError('Custom busy message');
      expect(error.message).toBe('Custom busy message');
    });
  });

  describe('SessionNotFoundError', () => {
    it('should create a SessionNotFoundError with the correct properties', () => {
      const error = new SessionNotFoundError('12345');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Session with ID 12345 not found');
      expect(error.errorCode).toBe('NOT_FOUND');
      expect(error.name).toBe('SessionNotFoundError');
    });
  });

  describe('TimeoutError', () => {
    it('should create a TimeoutError with the correct properties', () => {
      const error = new TimeoutError();
      expect(error.statusCode).toBe(408);
      expect(error.message).toBe('Request timed out');
      expect(error.errorCode).toBe('TIMEOUT');
      expect(error.name).toBe('TimeoutError');
    });

    it('should allow custom message', () => {
      const error = new TimeoutError('Custom timeout message');
      expect(error.message).toBe('Custom timeout message');
    });
  });
});