/**
 * Request validation middleware
 */
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';
import { z } from 'zod';

/**
 * Validate request body against a schema
 */
export function validateBody<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.parse(req.body);
      req.body = result;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Invalid request body', error.format()));
      } else {
        next(new ValidationError('Invalid request body'));
      }
    }
  };
}

/**
 * Validate request query parameters against a schema
 */
export function validateQuery<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.parse(req.query);
      req.query = result as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Invalid query parameters', error.format()));
      } else {
        next(new ValidationError('Invalid query parameters'));
      }
    }
  };
}

/**
 * Validate request params against a schema
 */
export function validateParams<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.parse(req.params);
      req.params = result as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Invalid path parameters', error.format()));
      } else {
        next(new ValidationError('Invalid path parameters'));
      }
    }
  };
}