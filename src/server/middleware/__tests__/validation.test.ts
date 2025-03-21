/**
 * Validation middleware tests
 */
import { Request, Response, NextFunction } from 'express';
import { validateBody, validateQuery, validateParams } from '../validation';
import { ValidationError } from '../../utils/errors';
import { z } from 'zod';

describe('Validation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {};
    nextFunction = jest.fn();
  });

  describe('validateBody', () => {
    const schema = z.object({
      name: z.string().min(3),
      age: z.number().int().positive(),
    });

    it('should call next() when validation passes', () => {
      mockRequest = {
        body: { name: 'Test', age: 30 },
      };

      validateBody(schema)(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should call next(ValidationError) when validation fails', () => {
      mockRequest = {
        body: { name: 'T', age: -5 },
      };

      validateBody(schema)(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });

  describe('validateQuery', () => {
    const schema = z.object({
      limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)),
      page: z.string().transform(Number).pipe(z.number().int().nonnegative()),
    });

    it('should call next() when validation passes', () => {
      mockRequest = {
        query: { limit: '20', page: '1' },
      };

      validateQuery(schema)(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should call next(ValidationError) when validation fails', () => {
      mockRequest = {
        query: { limit: '-5', page: 'abc' },
      };

      validateQuery(schema)(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });

  describe('validateParams', () => {
    const schema = z.object({
      id: z.string().uuid(),
    });

    it('should call next() when validation passes', () => {
      mockRequest = {
        params: { id: '123e4567-e89b-12d3-a456-426614174000' },
      };

      validateParams(schema)(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should call next(ValidationError) when validation fails', () => {
      mockRequest = {
        params: { id: 'not-a-uuid' },
      };

      validateParams(schema)(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });
});