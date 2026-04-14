/**
 * Rate-limit exhaustion integration tests.
 *
 * These tests prove that when a real endpoint's rate-limit budget is exhausted
 * the server returns HTTP 429 with the expected payload contract.
 *
 * Why a dedicated file?
 * ─────────────────────
 * express-rate-limit instances are created once at module-load time using values
 * from env.ts.  To exercise a deterministic low limit without touching production
 * defaults we:
 *
 *   1. Set RATE_LIMIT_WRITE / RATE_LIMIT_READ to small values in process.env
 *      BEFORE any app module is imported in this worker.
 *   2. Call jest.resetModules() so that the subsequent require() re-evaluates
 *      env.ts (and therefore rateLimiter.ts) against the overridden values.
 *   3. Restore the env vars in afterAll.
 *
 * Jest runs each test file in its own worker process (--forceExit is also set),
 * so the overrides are completely isolated from every other test file.  The
 * in-memory rate-limit store in this worker starts at zero, giving a clean
 * baseline that makes exhaustion deterministic.
 *
 * Middleware order on POST /threads (relevant for write exhaustion):
 *   authMiddleware → orgScopeMiddleware → denyRole → checkBanMute
 *   → writeRateLimiter  ← budget consumed here
 *   → validate({ body }) ← 400 returned here for an empty body
 *
 * So an empty-body POST passes all pre-limiter guards (auth, scope, role, ban)
 * and consumes the write budget even though the handler never runs.
 */

import request from 'supertest';
import type { Express } from 'express';

const ORG_ID = '00000000-0000-0000-0000-000000000001';

// How many requests are allowed before the 429 fires.
const WRITE_LIMIT = 3;
const READ_LIMIT = 5;

// Shared across all tests in this file – both limiters key on req.user.id.
let app: Express;
let adminToken: string;

// ─── Module-level setup ───────────────────────────────────────────────────────

beforeAll(async () => {
  // Override limits BEFORE any app module is loaded in this worker.
  process.env.RATE_LIMIT_WRITE = String(WRITE_LIMIT);
  process.env.RATE_LIMIT_READ = String(READ_LIMIT);

  // Discard any previously cached modules so require() re-evaluates env.ts and
  // rateLimiter.ts with the overrides above.
  jest.resetModules();

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { app: freshApp } = require('../../src/app') as { app: Express };
  app = freshApp;

  // Authenticate using the seeded admin account.  The /api/auth/login route
  // does not pass through writeRateLimiter, so this call does not consume the
  // write budget that the exhaustion tests depend on.
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'Admin12345678!', organizationId: ORG_ID });
  adminToken = loginRes.body.token;
  expect(typeof adminToken).toBe('string'); // fail fast if login itself breaks
});

afterAll(() => {
  // Remove overrides so they do not leak into subsequent workers (safety belt –
  // Jest already isolates workers, but explicit cleanup is clearer).
  delete process.env.RATE_LIMIT_WRITE;
  delete process.env.RATE_LIMIT_READ;
});

// ─── Read-path exhaustion ─────────────────────────────────────────────────────

describe(`readRateLimiter: GET /threads exhaustion at limit ${READ_LIMIT}`, () => {
  it(`allows the first ${READ_LIMIT} GET requests (200 each, budget consumed)`, async () => {
    for (let i = 0; i < READ_LIMIT; i++) {
      const r = await request(app)
        .get(`/api/organizations/${ORG_ID}/threads`)
        .set('Authorization', `Bearer ${adminToken}`);
      // Must not be rate-limited yet; the endpoint should return 200.
      expect(r.status).not.toBe(429);
      expect(r.status).toBe(200);
    }
  });

  it(`returns 429 RATE_LIMITED on request ${READ_LIMIT + 1} with full payload contract`, async () => {
    const r = await request(app)
      .get(`/api/organizations/${ORG_ID}/threads`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Status
    expect(r.status).toBe(429);

    // Payload contract
    expect(r.body.error.code).toBe('RATE_LIMITED');
    expect(r.body.error.message).toBe('Too many requests');
    expect(typeof r.body.error.retryAfter).toBe('number');
    expect(r.body.error.retryAfter).toBeGreaterThan(0);

    // RateLimit headers are still emitted on throttled responses
    expect(r.headers['ratelimit-limit']).toBeDefined();
    expect(r.headers['ratelimit-remaining']).toBeDefined();
  });
});

// ─── Write-path exhaustion ────────────────────────────────────────────────────

describe(`writeRateLimiter: POST /threads exhaustion at limit ${WRITE_LIMIT}`, () => {
  it(`consumes the first ${WRITE_LIMIT} POST requests without 429 (rate limiter precedes validation)`, async () => {
    for (let i = 0; i < WRITE_LIMIT; i++) {
      // Empty body → auth/scope/role/ban guards pass → writeRateLimiter
      // increments and passes → validate fires → 400 VALIDATION_ERROR.
      // The write budget IS consumed even though the handler never runs.
      const r = await request(app)
        .post(`/api/organizations/${ORG_ID}/threads`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(r.status).not.toBe(429); // must not be throttled yet
      expect(r.status).toBe(400);     // validation fires after the limiter
    }
  });

  it(`returns 429 RATE_LIMITED on request ${WRITE_LIMIT + 1} with full payload contract`, async () => {
    const r = await request(app)
      .post(`/api/organizations/${ORG_ID}/threads`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    // Status
    expect(r.status).toBe(429);

    // Payload contract
    expect(r.body.error.code).toBe('RATE_LIMITED');
    expect(r.body.error.message).toBe('Too many requests');
    expect(typeof r.body.error.retryAfter).toBe('number');
    expect(r.body.error.retryAfter).toBeGreaterThan(0);

    // RateLimit headers are still emitted on throttled responses
    expect(r.headers['ratelimit-limit']).toBeDefined();
    expect(r.headers['ratelimit-remaining']).toBeDefined();
  });
});
