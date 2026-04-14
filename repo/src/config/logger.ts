import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      '*.password',
      '*.passwordHash',
      '*.password_hash',
      '*.token',
      '*.emailEncrypted',
      '*.email_encrypted',
      '*.currentPassword',
      '*.newPassword',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      correlationId: req.correlationId,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});
