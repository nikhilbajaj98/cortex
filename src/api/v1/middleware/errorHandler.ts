import { Request, Response, NextFunction } from 'express';
import logger from '../../../utils/logger';

export interface ErrorResponse {
  error: string;
  message: string;
  timestamp: string;
  path: string;
  stack?: string;
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error(`❌ Error: ${error.message}`);
  logger.error(`Path: ${req.path}, Method: ${req.method}`);
  if (error.stack) {
    logger.error(`Stack: ${error.stack}`);
  }

  const errorResponse: ErrorResponse = {
    error: error.name || 'InternalServerError',
    message: error.message || 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  // Don't expose stack traces in production
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.stack = error.stack;
  }

  res.status(500).json(errorResponse);
};

export const notFoundHandler = (req: Request, res: Response) => {
  const errorResponse: ErrorResponse = {
    error: 'NotFound',
    message: `Route ${req.path} not found`,
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  res.status(404).json(errorResponse);
};
