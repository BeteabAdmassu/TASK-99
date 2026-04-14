import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

export const readRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_READ,
  keyGenerator: (req) => req.user?.id || req.ip || 'anonymous',
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests',
        retryAfter: Math.ceil(env.RATE_LIMIT_WINDOW_MS / 1000),
      },
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const writeRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_WRITE,
  keyGenerator: (req) => req.user?.id || req.ip || 'anonymous',
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests',
        retryAfter: Math.ceil(env.RATE_LIMIT_WINDOW_MS / 1000),
      },
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});
