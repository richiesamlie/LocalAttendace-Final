import type { Request, Response, NextFunction } from 'express';

// Custom API Error class
export class APIError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
  }
}

// Common error types
export const Errors = {
  NotFound: (resource: string = 'Resource') => new APIError(`${resource} not found`, 404),
  Unauthorized: () => new APIError('Unauthorized', 401),
  Forbidden: (message: string = 'Access denied') => new APIError(message, 403),
  BadRequest: (message: string = 'Bad request') => new APIError(message, 400),
  Conflict: (message: string = 'Resource already exists') => new APIError(message, 409),
};

// Express error handler middleware
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error for debugging
  if (process.env.NODE_ENV !== 'production') {
    console.error('Error:', err);
  }

  // Handle APIError
  if (err instanceof APIError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Handle specific error types
  if (err.name === 'SyntaxError') {
    res.status(400).json({ error: 'Invalid JSON in request body' });
    return;
  }

  // Database errors
  if (err.message?.includes('SQLITE_CONSTRAINT_UNIQUE')) {
    res.status(409).json({ error: 'Resource already exists' });
    return;
  }

  if (err.message?.includes('SQLITE_CONSTRAINT_FOREIGNKEY')) {
    res.status(400).json({ error: 'Referenced resource does not exist' });
    return;
  }

  // Default to 500
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Unknown error'
  });
}

// Async route wrapper to handle errors
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Request validation wrapper
export function validateRequest(validator: (body: any) => { valid: boolean; error?: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = validator(req.body);
    if (!result.valid) {
      res.status(400).json({ error: result.error || 'Validation failed' });
      return;
    }
    next();
  };
}
