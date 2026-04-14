import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.coerce.number().default(86400),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be exactly 64 hex characters').regex(/^[0-9a-fA-F]+$/, 'ENCRYPTION_KEY must be hex'),
  RATE_LIMIT_WRITE: z.coerce.number().default(120),
  RATE_LIMIT_READ: z.coerce.number().default(600),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  BACKUP_DIR: z.string().default('/backups'),
  BACKUP_RETENTION_DAYS: z.coerce.number().default(14),
  LOG_LEVEL: z.string().default('info'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().default('civicforum'),
  DB_PASSWORD: z.string().default('civicforum_pass'),
  DB_NAME: z.string().default('civicforum'),
  PLATFORM_ORG_ID: z.string().default('00000000-0000-0000-0000-000000000001'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
