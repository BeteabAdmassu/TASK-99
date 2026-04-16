/**
 * Jest setup file — runs in each worker BEFORE test files are loaded.
 * Provides env var fallbacks so that env.ts Zod validation succeeds
 * regardless of execution context (Docker test-runner or local dev).
 * Values already set externally (e.g. docker-compose environment) take precedence.
 */

const defaults: Record<string, string> = {
  DATABASE_URL: 'mysql://civicforum:dev-civicforum-change-in-production@localhost:3307/civicforum',
  JWT_SECRET: 'dev-jwt-secret-replace-before-production-use-0000000000000000',
  JWT_EXPIRES_IN: '86400',
  BCRYPT_ROUNDS: '4',
  ENCRYPTION_KEY: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  NODE_ENV: 'test',
  SEED_ADMIN_PASSWORD: 'Admin12345678!',
  RATE_LIMIT_WRITE: '120',
  RATE_LIMIT_READ: '600',
  RATE_LIMIT_WINDOW_MS: '60000',
  LOG_LEVEL: 'warn',
};

for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

export {};
