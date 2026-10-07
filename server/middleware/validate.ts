import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error: any) {
      if (error instanceof ZodError || error?.name === 'ZodError') {
        const issues = error.issues || error.errors || [];
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: issues.map((e: any) => ({
            field: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
            message: e.message
          }))
        });
      }
      return res.status(400).json({ success: false, error: 'Malformed request body' });
    }
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (error: any) {
      if (error instanceof ZodError || error?.name === 'ZodError') {
        const issues = error.issues || error.errors || [];
        return res.status(400).json({
          success: false,
          error: 'Query parameter validation failed',
          details: issues.map((e: any) => ({
            field: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
            message: e.message
          }))
        });
      }
      return res.status(400).json({ success: false, error: 'Malformed query parameters' });
    }
  };
}
