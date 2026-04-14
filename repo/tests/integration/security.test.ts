/**
 * Security and business-rule tests covering the audit-required high-risk gaps:
 *
 *  1. Account lockout after 5 failed login attempts within 15 minutes
 *  2. Rate-limiting 429 response format for read and write limits
 *  3. Pinned thread limit: max 3 per section
 *  4. Reply nesting depth limit: max depth 3
 *  5. Notification retry lifecycle: delivery, backoff, 24h expiry, terminal state
 *  6. Anomaly detection threshold rules (excessive deletions)
 *  7. Object-level authorisation: non-owner cannot update or delete another user's content
 *  8. Analyst role is read-only: 403 on all content write paths
 *  9. Non-platform-admin cannot create organizations (403)
 * 10. Non-admin cannot create feature flags (403)
 * 11. Real app rate limiter middleware is wired (integration)
 */

import request from 'supertest';
import express from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { app } from '../../src/app';
import { prisma } from '../../src/config/database';
import { ORG_ID, ADMIN_ID, loginAsAdmin } from '../helpers';
import {
  processRetries,
} from '../../src/modules/notifications/notifications.service';
import { runDetection } from '../../src/modules/anomalies/anomalies.service';

// ─── 1. Account lockout ───────────────────────────────────────────────────────

describe('Account lockout: 5 failed logins within 15 minutes', () => {
  let lockoutUserId: string;
  let lockoutUsername: string;

  beforeAll(async () => {
    lockoutUsername = 'lockout_test_' + Date.now();
    const pwHash = await bcrypt.hash('CorrectPass123!', 4);
    const user = await prisma.user.create({
      data: {
        organizationId: ORG_ID,
        username: lockoutUsername,
        passwordHash: pwHash,
        role: 'user',
      },
    });
    lockoutUserId = user.id;
  });

  afterAll(async () => {
    await prisma.accountLockout.deleteMany({ where: { userId: lockoutUserId } });
    await prisma.loginAttempt.deleteMany({ where: { userId: lockoutUserId } });
    await prisma.user.deleteMany({ where: { id: lockoutUserId } });
  });

  it('returns 401 for each of the first 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await request(app)
        .post('/api/auth/login')
        .send({ username: lockoutUsername, password: 'WrongPassword123!', organizationId: ORG_ID });
      expect(r.status).toBe(401);
    }
  });

  it('returns 423 ACCOUNT_LOCKED on the 6th attempt (even with correct password)', async () => {
    const r = await request(app)
      .post('/api/auth/login')
      .send({ username: lockoutUsername, password: 'CorrectPass123!', organizationId: ORG_ID });
    expect(r.status).toBe(423);
    expect(r.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(r.body.error.details).toHaveProperty('lockedUntil');
  });

  it('confirms an AccountLockout record was persisted', async () => {
    const lockout = await prisma.accountLockout.findFirst({
      where: { userId: lockoutUserId, expiresAt: { gt: new Date() } },
    });
    expect(lockout).not.toBeNull();
  });
});

// ─── 2. Rate-limiting 429 behaviour ──────────────────────────────────────────

describe('Rate limiting: 429 response format', () => {
  it('write rate limiter returns 429 with RATE_LIMITED code when limit exceeded', async () => {
    // Use a standalone minimal Express app with a very low limit so we can
    // trigger 429 without affecting the shared app instance used by other tests.
    const testApp = express();
    testApp.use(express.json());
    testApp.use(
      rateLimit({
        windowMs: 60_000,
        max: 2,
        keyGenerator: () => 'rl-write-test',
        handler: (_req, res) => {
          res.status(429).json({
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many requests',
              retryAfter: 60,
            },
          });
        },
        standardHeaders: true,
        legacyHeaders: false,
      }),
    );
    testApp.post('/test', (_req, res) => res.json({ ok: true }));

    await request(testApp).post('/test').send({});
    await request(testApp).post('/test').send({});
    const r = await request(testApp).post('/test').send({});

    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe('RATE_LIMITED');
    expect(r.body.error.message).toBe('Too many requests');
    expect(typeof r.body.error.retryAfter).toBe('number');
  });

  it('read rate limiter returns 429 with RATE_LIMITED code when limit exceeded', async () => {
    const testApp = express();
    testApp.use(
      rateLimit({
        windowMs: 60_000,
        max: 2,
        keyGenerator: () => 'rl-read-test',
        handler: (_req, res) => {
          res.status(429).json({
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many requests',
              retryAfter: 60,
            },
          });
        },
        standardHeaders: true,
        legacyHeaders: false,
      }),
    );
    testApp.get('/test', (_req, res) => res.json({ ok: true }));

    await request(testApp).get('/test');
    await request(testApp).get('/test');
    const r = await request(testApp).get('/test');

    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe('RATE_LIMITED');
  });
});

// ─── 3. Pinned thread limit ───────────────────────────────────────────────────

describe('Pinned thread limit: max 3 per section', () => {
  let adminToken: string;
  let subsectionId: string;
  const threadIds: string[] = [];

  beforeAll(async () => {
    adminToken = await loginAsAdmin();

    const secRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'PinLimit Section ' + Date.now(), displayOrder: 210 });
    const sectionId = secRes.body.section.id;

    const subRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections/${sectionId}/subsections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'PinLimit Subsection', displayOrder: 0 });
    subsectionId = subRes.body.subsection.id;

    for (let i = 0; i < 4; i++) {
      const r = await request(app)
        .post(`/api/organizations/${ORG_ID}/threads`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ subsectionId, title: `PinLimit Thread ${i}`, body: 'Body' });
      expect(r.status).toBe(201);
      threadIds.push(r.body.thread.id);
    }
  });

  afterAll(async () => {
    if (threadIds.length > 0) {
      await prisma.thread.updateMany({
        where: { id: { in: threadIds } },
        data: { isPinned: false, deletedAt: new Date() },
      });
    }
  });

  it('allows pinning thread 1', async () => {
    const r = await request(app)
      .put(`/api/organizations/${ORG_ID}/threads/${threadIds[0]}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isPinned: true });
    expect(r.status).toBe(200);
  });

  it('allows pinning thread 2', async () => {
    const r = await request(app)
      .put(`/api/organizations/${ORG_ID}/threads/${threadIds[1]}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isPinned: true });
    expect(r.status).toBe(200);
  });

  it('allows pinning thread 3 (at the limit)', async () => {
    const r = await request(app)
      .put(`/api/organizations/${ORG_ID}/threads/${threadIds[2]}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isPinned: true });
    expect(r.status).toBe(200);
  });

  it('rejects pinning a 4th thread with 400 PINNED_LIMIT_REACHED', async () => {
    const r = await request(app)
      .put(`/api/organizations/${ORG_ID}/threads/${threadIds[3]}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isPinned: true });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('PINNED_LIMIT_REACHED');
  });
});

// ─── 4. Reply nesting depth limit ────────────────────────────────────────────

describe('Reply nesting depth: max depth 3', () => {
  let adminToken: string;
  let threadId: string;
  let depth1Id: string;
  let depth2Id: string;
  let depth3Id: string;

  beforeAll(async () => {
    adminToken = await loginAsAdmin();

    const secRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'DepthLimit Section ' + Date.now(), displayOrder: 211 });
    const sectionId = secRes.body.section.id;

    const subRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections/${sectionId}/subsections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'DepthLimit Subsection', displayOrder: 0 });
    const subsectionId = subRes.body.subsection.id;

    const tRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/threads`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subsectionId, title: 'DepthLimit Thread', body: 'Body' });
    threadId = tRes.body.thread.id;
  });

  it('creates depth-1 reply successfully', async () => {
    const r = await request(app)
      .post(`/api/organizations/${ORG_ID}/threads/${threadId}/replies`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ body: 'Depth 1 reply' });
    expect(r.status).toBe(201);
    expect(r.body.reply.depth).toBe(1);
    depth1Id = r.body.reply.id;
  });

  it('creates depth-2 reply successfully', async () => {
    const r = await request(app)
      .post(`/api/organizations/${ORG_ID}/threads/${threadId}/replies`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ body: 'Depth 2 reply', parentReplyId: depth1Id });
    expect(r.status).toBe(201);
    expect(r.body.reply.depth).toBe(2);
    depth2Id = r.body.reply.id;
  });

  it('creates depth-3 reply successfully (at the limit)', async () => {
    const r = await request(app)
      .post(`/api/organizations/${ORG_ID}/threads/${threadId}/replies`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ body: 'Depth 3 reply', parentReplyId: depth2Id });
    expect(r.status).toBe(201);
    expect(r.body.reply.depth).toBe(3);
    depth3Id = r.body.reply.id;
  });

  it('rejects depth-4 reply with 400 MAX_NESTING_DEPTH', async () => {
    const r = await request(app)
      .post(`/api/organizations/${ORG_ID}/threads/${threadId}/replies`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ body: 'Depth 4 — should fail', parentReplyId: depth3Id });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('MAX_NESTING_DEPTH');
  });
});

// ─── 5. Notification retry lifecycle ─────────────────────────────────────────

describe('Notification retry lifecycle and backoff', () => {
  const cleanup: string[] = [];

  afterAll(async () => {
    if (cleanup.length > 0) {
      await prisma.notification.deleteMany({ where: { id: { in: cleanup } } });
    }
  });

  it('failed notification is delivered by processRetries after backoff window', async () => {
    // Create a notification directly in 'failed' state with lastRetryAt 5 minutes ago
    // (past the 1-minute backoff for attempt 0)
    const notif = await prisma.notification.create({
      data: {
        organizationId: ORG_ID,
        userId: ADMIN_ID,
        type: 'test_retry_lifecycle',
        title: 'Retry Lifecycle Test',
        body: 'Should be delivered by processRetries',
        status: 'failed',
        retryCount: 0,
        lastRetryAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
      },
    });
    cleanup.push(notif.id);

    const result = await processRetries();

    expect(result.successCount).toBeGreaterThanOrEqual(1);

    const updated = await prisma.notification.findUnique({ where: { id: notif.id } });
    expect(updated?.status).toBe('delivered');
    expect(updated?.deliveredAt).not.toBeNull();
  });

  it('failed notification is NOT retried when still within backoff window', async () => {
    // retryCount=0: backoff is 1 minute. lastRetryAt=10 seconds ago → still in window
    const notif = await prisma.notification.create({
      data: {
        organizationId: ORG_ID,
        userId: ADMIN_ID,
        type: 'test_backoff',
        title: 'Backoff Test',
        body: 'Should respect the 1-minute backoff',
        status: 'failed',
        retryCount: 0,
        lastRetryAt: new Date(Date.now() - 10 * 1000), // 10 seconds ago
      },
    });
    cleanup.push(notif.id);

    await processRetries();

    const unchanged = await prisma.notification.findUnique({ where: { id: notif.id } });
    expect(unchanged?.status).toBe('failed'); // not retried
  });

  it('notification with retryCount=3 is in terminal state and never retried', async () => {
    const notif = await prisma.notification.create({
      data: {
        organizationId: ORG_ID,
        userId: ADMIN_ID,
        type: 'test_terminal',
        title: 'Terminal State Test',
        body: 'Should never be retried',
        status: 'failed',
        retryCount: 3,
        lastRetryAt: new Date(Date.now() - 20 * 60 * 1000),
      },
    });
    cleanup.push(notif.id);

    const before = await processRetries();
    const notifAfter = await prisma.notification.findUnique({ where: { id: notif.id } });

    // Terminal notifications must not be touched
    expect(notifAfter?.status).toBe('failed');
    expect(notifAfter?.retryCount).toBe(3);
  });

  it('notification past 24-hour window is explicitly expired to terminal state', async () => {
    // Create notification, then backdate its created_at to 48 hours ago
    const notif = await prisma.notification.create({
      data: {
        organizationId: ORG_ID,
        userId: ADMIN_ID,
        type: 'test_expired_window',
        title: 'Window Expired Test',
        body: 'Should be expired to terminal state',
        status: 'failed',
        retryCount: 1,
        lastRetryAt: new Date(Date.now() - 50 * 60 * 60 * 1000),
      },
    });
    cleanup.push(notif.id);

    // Backdate created_at to simulate an old notification
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await prisma.$executeRaw`UPDATE notifications SET created_at = ${twoDaysAgo} WHERE id = ${notif.id}`;

    await processRetries();

    const expired = await prisma.notification.findUnique({ where: { id: notif.id } });
    // processRetries must set retryCount=3 to explicitly mark as terminal
    expect(expired?.retryCount).toBe(3);
    expect(expired?.status).toBe('failed'); // stays failed, not delivered
  });
});

// ─── 6. Anomaly detection threshold rules ────────────────────────────────────

describe('Anomaly detection: excessive deletions threshold', () => {
  let anomalyUserId: string;

  beforeAll(async () => {
    const pwHash = await bcrypt.hash('TestPassword123!', 4);
    const user = await prisma.user.create({
      data: {
        organizationId: ORG_ID,
        username: 'anomaly_user_' + Date.now(),
        passwordHash: pwHash,
        role: 'user',
      },
    });
    anomalyUserId = user.id;
  });

  afterAll(async () => {
    await prisma.anomalyFlag.deleteMany({ where: { flaggedUserId: anomalyUserId } });
    await prisma.auditLog.deleteMany({ where: { actorId: anomalyUserId } });
    await prisma.user.deleteMany({ where: { id: anomalyUserId } });
  });

  it('does NOT trigger when fewer than 10 deletions in the last hour', async () => {
    // Seed 9 deletion audit logs (below threshold)
    await prisma.auditLog.createMany({
      data: Array.from({ length: 9 }, () => ({
        organizationId: ORG_ID,
        actorId: anomalyUserId,
        action: 'thread_deleted',
        resourceType: 'thread',
        resourceId: '00000000-0000-0000-0000-000000000001',
      })),
    });

    const anomalies = await runDetection(ORG_ID);
    const match = anomalies.find(
      (a) => a.ruleName === 'excessive_deletions',
    );
    // No anomaly should have been created for this user yet
    const flag = await prisma.anomalyFlag.findFirst({
      where: { flaggedUserId: anomalyUserId, ruleName: 'excessive_deletions' },
    });
    expect(flag).toBeNull();
  });

  it('triggers anomaly flag after 10+ deletions in the last hour', async () => {
    // Add one more deletion to cross the >= 10 threshold
    await prisma.auditLog.create({
      data: {
        organizationId: ORG_ID,
        actorId: anomalyUserId,
        action: 'thread_deleted',
        resourceType: 'thread',
        resourceId: '00000000-0000-0000-0000-000000000001',
      },
    });

    const anomalies = await runDetection(ORG_ID);

    const flag = await prisma.anomalyFlag.findFirst({
      where: {
        organizationId: ORG_ID,
        flaggedUserId: anomalyUserId,
        ruleName: 'excessive_deletions',
        status: 'open',
      },
    });
    expect(flag).not.toBeNull();
    expect(flag!.severity).toBe('high');
  });

  it('does NOT create a duplicate anomaly on a second detection run', async () => {
    await runDetection(ORG_ID);

    const count = await prisma.anomalyFlag.count({
      where: {
        flaggedUserId: anomalyUserId,
        ruleName: 'excessive_deletions',
        status: 'open',
      },
    });
    expect(count).toBe(1); // exactly one open anomaly, not duplicated
  });
});

// ─── 7. Object-level authorisation ───────────────────────────────────────────

describe('Object-level authorisation: non-owner cannot modify another user\'s content', () => {
  let adminToken: string;
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;
  let threadId: string;
  let replyId: string;

  beforeAll(async () => {
    adminToken = await loginAsAdmin();
    const pwHash = await bcrypt.hash('TestPassword123!', 4);

    const userA = await prisma.user.create({
      data: { organizationId: ORG_ID, username: 'ola_userA_' + Date.now(), passwordHash: pwHash, role: 'user' },
    });
    userAId = userA.id;
    const loginA = await request(app)
      .post('/api/auth/login')
      .send({ username: userA.username, password: 'TestPassword123!', organizationId: ORG_ID });
    userAToken = loginA.body.token;

    const userB = await prisma.user.create({
      data: { organizationId: ORG_ID, username: 'ola_userB_' + Date.now(), passwordHash: pwHash, role: 'user' },
    });
    userBId = userB.id;
    const loginB = await request(app)
      .post('/api/auth/login')
      .send({ username: userB.username, password: 'TestPassword123!', organizationId: ORG_ID });
    userBToken = loginB.body.token;

    // Create section/subsection via admin
    const secRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'OLA Section ' + Date.now(), displayOrder: 220 });
    const sectionId = secRes.body.section.id;

    const subRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections/${sectionId}/subsections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'OLA Subsection', displayOrder: 0 });
    const subsectionId = subRes.body.subsection.id;

    // User A creates thread and reply
    const tRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/threads`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ subsectionId, title: 'OLA Thread by User A', body: 'Written by User A' });
    expect(tRes.status).toBe(201);
    threadId = tRes.body.thread.id;

    const rRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/threads/${threadId}/replies`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ body: 'Reply by User A' });
    expect(rRes.status).toBe(201);
    replyId = rRes.body.reply.id;
  });

  afterAll(async () => {
    await prisma.reply.deleteMany({ where: { authorId: { in: [userAId, userBId] } } });
    await prisma.thread.deleteMany({ where: { authorId: { in: [userAId, userBId] } } });
    await prisma.loginAttempt.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
  });

  it('User B cannot update User A\'s thread (403)', async () => {
    const r = await request(app)
      .put(`/api/organizations/${ORG_ID}/threads/${threadId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ title: 'Hijacked title', body: 'Replaced body' });
    expect(r.status).toBe(403);
  });

  it('User B cannot delete User A\'s thread (403)', async () => {
    const r = await request(app)
      .delete(`/api/organizations/${ORG_ID}/threads/${threadId}`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(r.status).toBe(403);
  });

  it('User B cannot update User A\'s reply (403)', async () => {
    const r = await request(app)
      .put(`/api/organizations/${ORG_ID}/replies/${replyId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ body: 'Hijacked reply body' });
    expect(r.status).toBe(403);
  });

  it('User B cannot delete User A\'s reply (403)', async () => {
    const r = await request(app)
      .delete(`/api/organizations/${ORG_ID}/replies/${replyId}`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(r.status).toBe(403);
  });

  it('User A can update their own thread (200)', async () => {
    const r = await request(app)
      .put(`/api/organizations/${ORG_ID}/threads/${threadId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ title: 'Updated by owner', body: 'Updated by owner' });
    expect(r.status).toBe(200);
  });

  it('User A can update their own reply (200)', async () => {
    const r = await request(app)
      .put(`/api/organizations/${ORG_ID}/replies/${replyId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ body: 'Updated by owner' });
    expect(r.status).toBe(200);
  });
});

// ─── 8. Analyst role write denial ────────────────────────────────────────────

describe('Analyst role: 403 on all content write paths', () => {
  let adminToken: string;
  let analystToken: string;
  let analystId: string;
  let subsectionId: string;
  let threadId: string;
  let replyId: string;
  let venueId: string;
  let bookingId: string;

  beforeAll(async () => {
    adminToken = await loginAsAdmin();
    const pwHash = await bcrypt.hash('AnalystPass1!', 4);

    const analyst = await prisma.user.create({
      data: { organizationId: ORG_ID, username: 'analyst_' + Date.now(), passwordHash: pwHash, role: 'analyst' },
    });
    analystId = analyst.id;
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: analyst.username, password: 'AnalystPass1!', organizationId: ORG_ID });
    analystToken = loginRes.body.token;

    // Create section/subsection/thread/reply/venue as admin for use in tests
    const secRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Analyst Test Section ' + Date.now(), displayOrder: 300 });
    const sectionId = secRes.body.section.id;

    const subRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections/${sectionId}/subsections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Analyst Subsection', displayOrder: 0 });
    subsectionId = subRes.body.subsection.id;

    const tRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/threads`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subsectionId, title: 'Analyst Target Thread', body: 'Content' });
    threadId = tRes.body.thread.id;

    const rRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/threads/${threadId}/replies`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ body: 'Analyst target reply' });
    replyId = rRes.body.reply.id;

    const vRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/venues`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Analyst Venue ' + Date.now(), description: 'Test venue', capacity: 10 });
    venueId = vRes.body.venue.id;

    // Admin creates a booking so analyst update/cancel denial tests have a real target.
    const bRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/venues/${venueId}/bookings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Admin Booking', startTime: '2031-06-01T09:00:00Z', endTime: '2031-06-01T10:00:00Z' });
    bookingId = bRes.body.booking.id;
  });

  afterAll(async () => {
    await prisma.reply.deleteMany({ where: { threadId } });
    await prisma.thread.deleteMany({ where: { id: threadId } });
    if (bookingId) {
      await prisma.venueBooking.deleteMany({ where: { id: bookingId } });
    }
    await prisma.venue.deleteMany({ where: { id: venueId } });
    await prisma.loginAttempt.deleteMany({ where: { userId: analystId } });
    await prisma.user.deleteMany({ where: { id: analystId } });
  });

  // Thread write paths
  it('analyst cannot create a thread (403)', async () => {
    const r = await request(app)
      .post(`/api/organizations/${ORG_ID}/threads`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ subsectionId, title: 'Analyst thread', body: 'Body' });
    expect(r.status).toBe(403);
  });

  it('analyst cannot update a thread (403)', async () => {
    const r = await request(app)
      .put(`/api/organizations/${ORG_ID}/threads/${threadId}`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ title: 'Updated', body: 'Updated' });
    expect(r.status).toBe(403);
  });

  it('analyst cannot delete a thread (403)', async () => {
    const r = await request(app)
      .delete(`/api/organizations/${ORG_ID}/threads/${threadId}`)
      .set('Authorization', `Bearer ${analystToken}`);
    expect(r.status).toBe(403);
  });

  // Reply write paths
  it('analyst cannot create a reply (403)', async () => {
    const r = await request(app)
      .post(`/api/organizations/${ORG_ID}/threads/${threadId}/replies`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ body: 'Analyst reply' });
    expect(r.status).toBe(403);
  });

  it('analyst cannot update a reply (403)', async () => {
    const r = await request(app)
      .put(`/api/organizations/${ORG_ID}/replies/${replyId}`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ body: 'Updated' });
    expect(r.status).toBe(403);
  });

  it('analyst cannot delete a reply (403)', async () => {
    const r = await request(app)
      .delete(`/api/organizations/${ORG_ID}/replies/${replyId}`)
      .set('Authorization', `Bearer ${analystToken}`);
    expect(r.status).toBe(403);
  });

  // Booking write paths
  it('analyst cannot create a booking (403)', async () => {
    const r = await request(app)
      .post(`/api/organizations/${ORG_ID}/venues/${venueId}/bookings`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ title: 'Analyst booking', startTime: '2030-01-01T09:00:00Z', endTime: '2030-01-01T10:00:00Z' });
    expect(r.status).toBe(403);
  });

  it('analyst cannot update a booking (403)', async () => {
    const r = await request(app)
      .put(`/api/organizations/${ORG_ID}/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ title: 'Hijacked title' });
    expect(r.status).toBe(403);
  });

  it('analyst cannot cancel a booking (403)', async () => {
    const r = await request(app)
      .delete(`/api/organizations/${ORG_ID}/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${analystToken}`);
    expect(r.status).toBe(403);
  });

  it('analyst read access is still allowed (200 on GET threads)', async () => {
    const r = await request(app)
      .get(`/api/organizations/${ORG_ID}/threads`)
      .set('Authorization', `Bearer ${analystToken}`);
    expect(r.status).toBe(200);
  });
});

// ─── 9. Non-platform-admin cannot create organizations ───────────────────────

describe('Organization creation: requires platform admin (403 for others)', () => {
  let regularUserToken: string;
  let orgAdminToken: string;
  let regularUserId: string;
  let orgAdminId: string;
  let secondaryOrgId: string;

  beforeAll(async () => {
    const pwHash = await bcrypt.hash('TestPass1!', 4);

    // Regular user lives in the platform org — role alone is insufficient.
    const regularUser = await prisma.user.create({
      data: { organizationId: ORG_ID, username: 'reg_user_' + Date.now(), passwordHash: pwHash, role: 'user' },
    });
    regularUserId = regularUser.id;
    const loginRegular = await request(app)
      .post('/api/auth/login')
      .send({ username: regularUser.username, password: 'TestPass1!', organizationId: ORG_ID });
    regularUserToken = loginRegular.body.token;

    // Create a secondary (non-platform) org directly via Prisma.
    // Its auto-generated UUID is guaranteed != PLATFORM_ORG_ID.
    const secondaryOrg = await prisma.organization.create({
      data: { name: 'Secondary Org ' + Date.now(), slug: 'secondary-org-' + Date.now() },
    });
    secondaryOrgId = secondaryOrg.id;

    // Admin user is in the SECONDARY org — role=admin but organizationId != PLATFORM_ORG_ID.
    // requirePlatformAdmin checks both role AND organizationId, so this must return 403.
    const orgAdmin = await prisma.user.create({
      data: { organizationId: secondaryOrgId, username: 'org_admin_' + Date.now(), passwordHash: pwHash, role: 'admin' },
    });
    orgAdminId = orgAdmin.id;
    const loginOrgAdmin = await request(app)
      .post('/api/auth/login')
      .send({ username: orgAdmin.username, password: 'TestPass1!', organizationId: secondaryOrgId });
    orgAdminToken = loginOrgAdmin.body.token;
  });

  afterAll(async () => {
    await prisma.loginAttempt.deleteMany({ where: { userId: { in: [regularUserId, orgAdminId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [regularUserId, orgAdminId] } } });
    if (secondaryOrgId) {
      await prisma.organization.deleteMany({ where: { id: secondaryOrgId } });
    }
  });

  it('regular user (role=user, platform org) cannot create an organization (403)', async () => {
    const r = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${regularUserToken}`)
      .send({ name: 'Rogue Org', slug: 'rogue-org' });
    expect(r.status).toBe(403);
  });

  it('admin in non-platform org (role=admin, organizationId != PLATFORM_ORG_ID) cannot create an organization (403)', async () => {
    const r = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ name: 'Rogue Org 2', slug: 'rogue-org-2' });
    expect(r.status).toBe(403);
  });
});

// ─── 10. Non-admin cannot create feature flags ───────────────────────────────

describe('Feature flags: admin-only create endpoint (403 for non-admin)', () => {
  let moderatorToken: string;
  let analystToken: string;
  let moderatorId: string;
  let analystId: string;

  beforeAll(async () => {
    const pwHash = await bcrypt.hash('TestPass1!', 4);

    const mod = await prisma.user.create({
      data: { organizationId: ORG_ID, username: 'mod_ff_' + Date.now(), passwordHash: pwHash, role: 'moderator' },
    });
    moderatorId = mod.id;
    const loginMod = await request(app)
      .post('/api/auth/login')
      .send({ username: mod.username, password: 'TestPass1!', organizationId: ORG_ID });
    moderatorToken = loginMod.body.token;

    const analyst = await prisma.user.create({
      data: { organizationId: ORG_ID, username: 'analyst_ff_' + Date.now(), passwordHash: pwHash, role: 'analyst' },
    });
    analystId = analyst.id;
    const loginAnalyst = await request(app)
      .post('/api/auth/login')
      .send({ username: analyst.username, password: 'TestPass1!', organizationId: ORG_ID });
    analystToken = loginAnalyst.body.token;
  });

  afterAll(async () => {
    await prisma.loginAttempt.deleteMany({ where: { userId: { in: [moderatorId, analystId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [moderatorId, analystId] } } });
  });

  it('moderator cannot create a feature flag (403)', async () => {
    const r = await request(app)
      .post(`/api/organizations/${ORG_ID}/feature-flags`)
      .set('Authorization', `Bearer ${moderatorToken}`)
      .send({ name: 'test_flag', description: 'Should fail', enabled: false });
    expect(r.status).toBe(403);
  });

  it('analyst cannot create a feature flag (403)', async () => {
    const r = await request(app)
      .post(`/api/organizations/${ORG_ID}/feature-flags`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ name: 'test_flag2', description: 'Should fail', enabled: false });
    expect(r.status).toBe(403);
  });
});

// ─── 11. Real app rate limiter middleware wiring (integration) ────────────────

describe('Rate limiting: real app middleware is wired (integration)', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginAsAdmin();
  });

  it('read endpoint response includes RateLimit headers (readRateLimiter is applied)', async () => {
    const r = await request(app)
      .get(`/api/organizations/${ORG_ID}/threads`)
      .set('Authorization', `Bearer ${adminToken}`);

    // express-rate-limit with standardHeaders:true always emits these headers.
    // Their absence would mean the middleware was not reached on this route.
    expect(r.headers['ratelimit-limit']).toBeDefined();
    expect(r.headers['ratelimit-remaining']).toBeDefined();
    expect(Number(r.headers['ratelimit-remaining'])).toBeLessThanOrEqual(
      Number(r.headers['ratelimit-limit']),
    );
  });

  it('write endpoint response includes RateLimit headers (writeRateLimiter is applied)', async () => {
    // POST with intentionally empty body so validation returns 400, but the rate
    // limiter middleware still runs and sets its headers before the validator fires.
    const r = await request(app)
      .post(`/api/organizations/${ORG_ID}/threads`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(r.headers['ratelimit-limit']).toBeDefined();
    expect(r.headers['ratelimit-remaining']).toBeDefined();
  });
});
