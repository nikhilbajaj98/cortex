import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import logger from '../../../utils/logger';

// Rate limiting middleware
export const createRateLimit = (windowMs: number, max: number) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'TooManyRequests',
      message: 'Too many requests from this IP, please try again later.',
      timestamp: new Date().toISOString(),
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.warn(`🚫 Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        error: 'TooManyRequests',
        message: 'Too many requests from this IP, please try again later.',
        timestamp: new Date().toISOString(),
      });
    },
  });
};

// Different rate limits for different endpoints
export const ingestRateLimit = createRateLimit(15 * 60 * 1000, 1000); // 1000 requests per 15 minutes
export const apiRateLimit = createRateLimit(15 * 60 * 1000, 100); // 100 requests per 15 minutes
export const strictRateLimit = createRateLimit(15 * 60 * 1000, 10); // 10 requests per 15 minutes
