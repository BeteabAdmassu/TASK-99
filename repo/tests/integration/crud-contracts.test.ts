/**
 * Deep response-body contract tests.
 *
 * These tests go beyond status-code checks to validate the exact shape,
 * types, and invariants of API responses — ensuring clients can rely on
 * the documented contract.
 */

import request from 'supertest';
import { app } from '../../src/app';
import { ORG_ID, loginAsAdmin, uniqueUsername } from '../helpers';

let adminToken: string;

beforeAll(async () => {
  adminToken = await loginAsAdmin();
});

// ─── Health endpoint ──────────────────────────────────────────────────────

describe('GET /api/health — response contract', () => {
  it('returns {status, timestamp, version} with correct types', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      timestamp: expect.any(String),
      version: expect.any(String),
    });
    // timestamp must be ISO 8601
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });
});

// ─── Auth endpoints ───────────────────────────────────────────────────────

describe('POST /api/auth/login — response contracts', () => {
  it('success: returns {token, user} with expected fields and no passwordHash', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'Admin12345678!', organizationId: ORG_ID });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.split('.').length).toBe(3); // JWT has 3 parts
    expect(res.body.user).toMatchObject({
      id: expect.any(String),
      username: 'admin',
      role: 'admin',
      organizationId: ORG_ID,
    });
    // Security: no password-related fields
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('failure: returns {error: {code, message}} with no user data', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'WrongPassword1!', organizationId: ORG_ID });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({
      code: 'UNAUTHORIZED',
      message: expect.any(String),
    });
    expect(res.body).not.toHaveProperty('token');
    expect(res.body).not.toHaveProperty('user');
  });

  it('validation: returns 400 with {error: {code: VALIDATION_ERROR, details}}', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'short', organizationId: ORG_ID });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error).toHaveProperty('details');
  });
});

// ─── Users ────────────────────────────────────────────────────────────────

describe('User endpoints — response contracts', () => {
  it('POST /users: returns {user} without passwordHash', async () => {
    const res = await request(app)
      .post(`/api/organizations/${ORG_ID}/users`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: uniqueUsername(), password: 'SecurePass123!' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      id: expect.any(String),
      username: expect.any(String),
      role: expect.any(String),
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('GET /users: returns paginated {data, total, page, limit}', async () => {
    const res = await request(app)
      .get(`/api/organizations/${ORG_ID}/users?page=1&limit=5`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(5);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
  });

  it('POST /users with duplicate → 409 CONFLICT with {error}', async () => {
    const username = uniqueUsername();
    await request(app)
      .post(`/api/organizations/${ORG_ID}/users`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username, password: 'SecurePass123!' });

    const res = await request(app)
      .post(`/api/organizations/${ORG_ID}/users`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username, password: 'SecurePass123!' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'CONFLICT',
      message: expect.any(String),
    });
  });
});

// ─── Threads ──────────────────────────────────────────────────────────────

describe('Thread endpoints — response contracts', () => {
  let sectionId: string;
  let subsectionId: string;
  let threadId: string;

  beforeAll(async () => {
    const secRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Contract Section ' + Date.now(), displayOrder: 500 });
    sectionId = secRes.body.section.id;

    const subRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections/${sectionId}/subsections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Contract Sub', displayOrder: 0 });
    subsectionId = subRes.body.subsection.id;
  });

  it('POST /threads: returns {thread} with id, title, body, authorId, subsectionId, createdAt', async () => {
    const res = await request(app)
      .post(`/api/organizations/${ORG_ID}/threads`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subsectionId, title: 'Contract Thread', body: 'Body text here.' });

    expect(res.status).toBe(201);
    expect(res.body.thread).toMatchObject({
      id: expect.any(String),
      title: 'Contract Thread',
      body: 'Body text here.',
      subsectionId,
      createdAt: expect.any(String),
    });
    expect(res.body.thread).toHaveProperty('authorId');
    threadId = res.body.thread.id;
  });

  it('GET /threads: returns paginated list', async () => {
    const res = await request(app)
      .get(`/api/organizations/${ORG_ID}/threads?subsectionId=${subsectionId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it('GET /threads/:id: returns {thread} with nested data', async () => {
    const res = await request(app)
      .get(`/api/organizations/${ORG_ID}/threads/${threadId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.thread.id).toBe(threadId);
    expect(res.body.thread).toHaveProperty('author');
    expect(res.body.thread.author).toHaveProperty('username');
  });

  it('GET /threads/:nonexistent → 404 NOT_FOUND', async () => {
    const res = await request(app)
      .get(`/api/organizations/${ORG_ID}/threads/00000000-0000-0000-0000-ffffffffffff`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({
      code: 'NOT_FOUND',
      message: expect.any(String),
    });
  });
});

// ─── Replies ──────────────────────────────────────────────────────────────

describe('Reply endpoints — response contracts', () => {
  let subsectionId: string;
  let threadId: string;

  beforeAll(async () => {
    const secRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Reply Contract Section ' + Date.now(), displayOrder: 501 });
    const sectionId = secRes.body.section.id;

    const subRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections/${sectionId}/subsections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Reply Contract Sub', displayOrder: 0 });
    subsectionId = subRes.body.subsection.id;

    const threadRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/threads`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subsectionId, title: 'Reply Contract Thread', body: 'Body' });
    threadId = threadRes.body.thread.id;
  });

  it('POST /replies: returns {reply} with id, body, authorId, threadId', async () => {
    const res = await request(app)
      .post(`/api/organizations/${ORG_ID}/threads/${threadId}/replies`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ body: 'A reply for contract testing.' });

    expect(res.status).toBe(201);
    expect(res.body.reply).toMatchObject({
      id: expect.any(String),
      body: 'A reply for contract testing.',
      threadId,
    });
    expect(res.body.reply).toHaveProperty('authorId');
    expect(res.body.reply).toHaveProperty('createdAt');
  });
});

// ─── Sections ─────────────────────────────────────────────────────────────

describe('Section endpoints — response contracts', () => {
  it('POST /sections: returns {section} with id, name, displayOrder', async () => {
    const res = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Contract Test Section ' + Date.now(), displayOrder: 502 });

    expect(res.status).toBe(201);
    expect(res.body.section).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      displayOrder: 502,
    });
  });
});

// ─── Venues & Bookings ───────────────────────────────────────────────────

describe('Venue & Booking endpoints — response contracts', () => {
  let venueId: string;

  it('POST /venues: returns {venue} with id, name, capacity', async () => {
    const res = await request(app)
      .post(`/api/organizations/${ORG_ID}/venues`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Contract Room ' + Date.now(), capacity: 30 });

    expect(res.status).toBe(201);
    expect(res.body.venue).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      capacity: 30,
    });
    venueId = res.body.venue.id;
  });

  it('POST /bookings: returns {booking} with id, title, startTime, endTime', async () => {
    const res = await request(app)
      .post(`/api/organizations/${ORG_ID}/venues/${venueId}/bookings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Contract Booking',
        startTime: '2028-01-15T10:00:00.000Z',
        endTime: '2028-01-15T12:00:00.000Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.booking).toMatchObject({
      id: expect.any(String),
      title: 'Contract Booking',
    });
    expect(res.body.booking).toHaveProperty('startTime');
    expect(res.body.booking).toHaveProperty('endTime');
  });
});

// ─── Error contracts ──────────────────────────────────────────────────────

describe('Error response contracts', () => {
  it('401: unauthenticated request returns {error: {code: UNAUTHORIZED}}', async () => {
    const res = await request(app)
      .get(`/api/organizations/${ORG_ID}/threads`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(typeof res.body.error.message).toBe('string');
  });

  it('403: wrong org returns {error: {code}}', async () => {
    const res = await request(app)
      .get('/api/organizations/00000000-0000-0000-0000-999999999999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(403);
    expect(typeof res.body.error.code).toBe('string');
  });

  it('Correlation ID header is present on every response', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-correlation-id']).toBeDefined();
    expect(typeof res.headers['x-correlation-id']).toBe('string');
  });

  it('Custom Correlation ID is echoed back', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('X-Correlation-ID', 'custom-test-id-42');
    expect(res.headers['x-correlation-id']).toBe('custom-test-id-42');
  });
});
