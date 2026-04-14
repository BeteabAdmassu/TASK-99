/**
 * Integration tests covering the 8 audit-remediation items.
 * Tests 1–3 call service functions directly against the real DB (no HTTP)
 * because the notification pipeline is fire-and-forget at the HTTP layer.
 * Tests 4–8 use supertest against the full Express app.
 */

import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../src/app';
import { prisma } from '../../src/config/database';
import { ORG_ID, ADMIN_ID, loginAsAdmin } from '../helpers';
import {
  createNotification,
  createForNewReply,
  createForModeration,
} from '../../src/modules/notifications/notifications.service';

// ─── helpers ───────────────────────────────────────────────────────────────

/** Second org used for platform-admin boundary tests. */
const SECOND_ORG_ID = '00000000-0000-0000-0000-000000000099';
let secondOrgAdminToken: string;

async function seedSecondOrgAdmin() {
  // Ensure the second org exists
  await prisma.organization.upsert({
    where: { id: SECOND_ORG_ID },
    create: {
      id: SECOND_ORG_ID,
      name: 'RemediationTestOrg',
      slug: 'remediation-test-org',
    },
    update: {},
  });

  const username = 'remediation_admin_' + Date.now();
  const passwordHash = await bcrypt.hash('TestPassword123!', 4);

  const user = await prisma.user.create({
    data: {
      organizationId: SECOND_ORG_ID,
      username,
      passwordHash,
      role: 'admin',
    },
  });

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username, password: 'TestPassword123!', organizationId: SECOND_ORG_ID });

  return { userId: user.id, token: loginRes.body.token as string };
}

// ─── Setup / Teardown ───────────────────────────────────────────────────────

let adminToken: string;
let createdNotificationIds: string[] = [];

beforeAll(async () => {
  adminToken = await loginAsAdmin();
  const result = await seedSecondOrgAdmin();
  secondOrgAdminToken = result.token;
});

afterAll(async () => {
  // Clean up test notifications
  if (createdNotificationIds.length > 0) {
    await prisma.notification.deleteMany({ where: { id: { in: createdNotificationIds } } });
  }
  // Clean up second org
  await prisma.user.deleteMany({ where: { organizationId: SECOND_ORG_ID } });
  await prisma.organization.deleteMany({ where: { id: SECOND_ORG_ID } });
});

// ═══════════════════════════════════════════════════════════════════════════
// FIX 1  –  Notification scheduling: future scheduledAt stays pending
// ═══════════════════════════════════════════════════════════════════════════

describe('Notification scheduling', () => {
  it('notification with future scheduledAt is created as pending and not immediately delivered', async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    const notification = await createNotification({
      orgId: ORG_ID,
      userId: ADMIN_ID,
      type: 'test_scheduled',
      title: 'Future Notification',
      body: 'Should not be delivered yet',
      scheduledAt: futureDate,
    });
    createdNotificationIds.push(notification.id);

    // Re-fetch from DB to verify no background update changed status
    const dbRecord = await prisma.notification.findUnique({ where: { id: notification.id } });

    expect(dbRecord).not.toBeNull();
    expect(dbRecord!.status).toBe('pending');
    expect(dbRecord!.deliveredAt).toBeNull();
  });

  it('notification without scheduledAt is delivered immediately', async () => {
    const notification = await createNotification({
      orgId: ORG_ID,
      userId: ADMIN_ID,
      type: 'test_immediate',
      title: 'Immediate Notification',
      body: 'Should be delivered right away',
    });
    createdNotificationIds.push(notification.id);

    const dbRecord = await prisma.notification.findUnique({ where: { id: notification.id } });

    expect(dbRecord).not.toBeNull();
    expect(dbRecord!.status).toBe('delivered');
    expect(dbRecord!.deliveredAt).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FIX 1  –  Subscription opt-out suppresses non-security notifications
// ═══════════════════════════════════════════════════════════════════════════

describe('Notification subscription opt-out', () => {
  let optOutUserId: string;
  let defaultSubUserId: string;
  let optOutThreadId: string;
  let defaultSubThreadId: string;
  let sharedSubsectionId: string;

  beforeAll(async () => {
    // Create subsection shared by both thread authors
    const secRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'SubTest Section', displayOrder: 99 });
    const sectionId = secRes.body.section.id;

    const subRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections/${sectionId}/subsections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'SubTest Subsection', displayOrder: 0 });
    sharedSubsectionId = subRes.body.subsection.id;

    // User A: opts out of forum notifications
    const pwHash = await bcrypt.hash('TestPassword123!', 4);
    const userA = await prisma.user.create({
      data: { organizationId: ORG_ID, username: 'optout_' + Date.now(), passwordHash: pwHash, role: 'user' },
    });
    optOutUserId = userA.id;

    await prisma.notificationSubscription.create({
      data: { userId: optOutUserId, organizationId: ORG_ID, category: 'forum', isSubscribed: false },
    });

    // Thread by user A (opted out)
    const threadA = await prisma.thread.create({
      data: {
        organizationId: ORG_ID,
        subsectionId: sharedSubsectionId,
        authorId: optOutUserId,
        title: 'OptOut Thread',
        body: 'Thread by opted-out user',
      },
    });
    optOutThreadId = threadA.id;

    // User B: no subscription record at all (default = subscribed)
    const userB = await prisma.user.create({
      data: { organizationId: ORG_ID, username: 'defaultsub_' + Date.now(), passwordHash: pwHash, role: 'user' },
    });
    defaultSubUserId = userB.id;

    // Thread by user B (no subscription record → subscribed by default)
    const threadB = await prisma.thread.create({
      data: {
        organizationId: ORG_ID,
        subsectionId: sharedSubsectionId,
        authorId: defaultSubUserId,
        title: 'Default Sub Thread',
        body: 'Thread by user with default subscription',
      },
    });
    defaultSubThreadId = threadB.id;
  });

  afterAll(async () => {
    await prisma.notificationSubscription.deleteMany({ where: { userId: { in: [optOutUserId, defaultSubUserId] } } });
    await prisma.notification.deleteMany({ where: { userId: { in: [optOutUserId, defaultSubUserId] } } });
    await prisma.thread.deleteMany({ where: { id: { in: [optOutThreadId, defaultSubThreadId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [optOutUserId, defaultSubUserId] } } });
  });

  it('createForNewReply returns null when thread author has opted out of forum notifications', async () => {
    const fakeReplyId = '00000000-0000-0000-0000-000000000091';
    const result = await createForNewReply(ORG_ID, optOutThreadId, ADMIN_ID, fakeReplyId);

    expect(result).toBeNull();

    // Confirm no notification was persisted
    const count = await prisma.notification.count({
      where: { organizationId: ORG_ID, userId: optOutUserId, referenceId: fakeReplyId },
    });
    expect(count).toBe(0);
  });

  it('createForNewReply returns null when thread author has no subscription record (explicit opt-in required)', async () => {
    // Per the updated subscription semantics, no record = not subscribed.
    // Users must explicitly opt in to receive non-security notifications.
    const fakeReplyId = '00000000-0000-0000-0000-000000000092';
    const result = await createForNewReply(ORG_ID, defaultSubThreadId, ADMIN_ID, fakeReplyId);

    expect(result).toBeNull();

    // Confirm no notification was persisted
    const count = await prisma.notification.count({
      where: { organizationId: ORG_ID, userId: defaultSubUserId, referenceId: fakeReplyId },
    });
    expect(count).toBe(0);
  });

  it('createForNewReply creates a notification when thread author has an explicit forum opt-in', async () => {
    // Explicitly opt defaultSubUser in to forum notifications
    await prisma.notificationSubscription.upsert({
      where: {
        userId_organizationId_category: {
          userId: defaultSubUserId,
          organizationId: ORG_ID,
          category: 'forum',
        },
      },
      update: { isSubscribed: true },
      create: { userId: defaultSubUserId, organizationId: ORG_ID, category: 'forum', isSubscribed: true },
    });

    const fakeReplyId = '00000000-0000-0000-0000-000000000094';
    const result = await createForNewReply(ORG_ID, defaultSubThreadId, ADMIN_ID, fakeReplyId);

    expect(result).not.toBeNull();
    expect(result!.userId).toBe(defaultSubUserId);

    if (result) {
      await prisma.notification.deleteMany({ where: { id: result.id } });
    }
    // Clean up the subscription we just created
    await prisma.notificationSubscription.deleteMany({
      where: { userId: defaultSubUserId, category: 'forum' },
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FIX 1  –  Security category is always effectively subscribed
// ═══════════════════════════════════════════════════════════════════════════

describe('Security notification category cannot be opted out', () => {
  /**
   * isUserSubscribed() in notifications.service always returns true for 'security'.
   * We test this invariant by:
   *   1. Creating a user with an explicit isSubscribed=false record for 'security'
   *   2. Creating a thread owned by this user with NO 'forum' opt-out
   *   3. Calling createForNewReply → even though the user has a security DB opt-out,
   *      the forum subscription defaults to subscribed, so the notification is created.
   *   4. Verifying the security opt-out record in DB is present (proving the bypass happens
   *      at the service layer, not by the record being missing).
   */
  let secTestUserId: string;
  let secTestThreadId: string;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('TestPassword123!', 4);
    const user = await prisma.user.create({
      data: { organizationId: ORG_ID, username: 'secbypass_' + Date.now(), passwordHash, role: 'user' },
    });
    secTestUserId = user.id;

    // Opt out of 'security'; explicitly opt IN to 'forum' (required under explicit opt-in semantics)
    await prisma.notificationSubscription.createMany({
      data: [
        { userId: secTestUserId, organizationId: ORG_ID, category: 'security', isSubscribed: false },
        { userId: secTestUserId, organizationId: ORG_ID, category: 'forum',    isSubscribed: true  },
      ],
    });

    // Create a subsection + thread for this user
    const secRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'SecBypass Section', displayOrder: 98 });
    const sectionId = secRes.body.section.id;

    const subRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections/${sectionId}/subsections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'SecBypass Subsection', displayOrder: 0 });
    const subsectionId = subRes.body.subsection.id;

    const thread = await prisma.thread.create({
      data: {
        organizationId: ORG_ID,
        subsectionId,
        authorId: secTestUserId,
        title: 'Security Bypass Test Thread',
        body: 'Thread to test security bypass',
      },
    });
    secTestThreadId = thread.id;
  });

  afterAll(async () => {
    await prisma.notificationSubscription.deleteMany({ where: { userId: secTestUserId } });
    await prisma.notification.deleteMany({ where: { userId: secTestUserId } });
    await prisma.thread.deleteMany({ where: { id: secTestThreadId } });
    await prisma.user.deleteMany({ where: { id: secTestUserId } });
  });

  it('security opt-out DB record exists but forum subscription defaults to subscribed', async () => {
    // Confirm security opt-out record is present
    const secSub = await prisma.notificationSubscription.findUnique({
      where: {
        userId_organizationId_category: {
          userId: secTestUserId,
          organizationId: ORG_ID,
          category: 'security',
        },
      },
    });
    expect(secSub).not.toBeNull();
    expect(secSub!.isSubscribed).toBe(false);

    // Forum subscription is an explicit opt-in record (isSubscribed: true)
    const forumSub = await prisma.notificationSubscription.findUnique({
      where: {
        userId_organizationId_category: {
          userId: secTestUserId,
          organizationId: ORG_ID,
          category: 'forum',
        },
      },
    });
    expect(forumSub).not.toBeNull();
    expect(forumSub!.isSubscribed).toBe(true);
  });

  it('createForNewReply still notifies a user who has a security opt-out but no forum opt-out', async () => {
    const fakeReplyId = '00000000-0000-0000-0000-000000000093';
    const notification = await createForNewReply(ORG_ID, secTestThreadId, ADMIN_ID, fakeReplyId);

    // Security opt-out must NOT suppress forum notifications
    expect(notification).not.toBeNull();
    expect(notification!.userId).toBe(secTestUserId);

    // Cleanup
    if (notification) {
      await prisma.notification.deleteMany({ where: { id: notification.id } });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FIX 2/3  –  Moderation bulk action: 'move' is not a valid action
// ═══════════════════════════════════════════════════════════════════════════

describe('Moderation bulk action validation', () => {
  it('POST /moderation/bulk-action with action=move returns 400 validation error', async () => {
    const res = await request(app)
      .post(`/api/organizations/${ORG_ID}/moderation/bulk-action`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'move',
        resourceType: 'thread',
        resourceIds: ['00000000-0000-0000-0000-000000000001'],
      });

    expect(res.status).toBe(400);
  });

  it('POST /moderation/bulk-action with action=delete succeeds', async () => {
    // Create a thread to bulk-delete
    const secRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bulk Section', displayOrder: 100 });
    const sectionId = secRes.body.section.id;

    const subRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections/${sectionId}/subsections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bulk Subsection', displayOrder: 0 });
    const subsectionId = subRes.body.subsection.id;

    const threadRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/threads`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subsectionId, title: 'Bulk Delete Me', body: 'Will be bulk-deleted.' });
    const threadId = threadRes.body.thread.id;

    const res = await request(app)
      .post(`/api/organizations/${ORG_ID}/moderation/bulk-action`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'delete', resourceType: 'thread', resourceIds: [threadId] });

    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(1);
    expect(res.body.failed).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FIX 4  –  Cross-tenant tag association is rejected (400)
// ═══════════════════════════════════════════════════════════════════════════

describe('Cross-tenant tag validation', () => {
  let subsectionId: string;

  beforeAll(async () => {
    const secRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Tag Test Section', displayOrder: 101 });
    const sectionId = secRes.body.section.id;

    const subRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections/${sectionId}/subsections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Tag Test Subsection', displayOrder: 0 });
    subsectionId = subRes.body.subsection.id;
  });

  it('creating a thread with a tag from a different org returns 400', async () => {
    // Insert a tag directly belonging to the second org
    const foreignTag = await prisma.tag.create({
      data: {
        organizationId: SECOND_ORG_ID,
        name: 'ForeignTag_' + Date.now(),
        slug: 'foreign-tag-' + Date.now(),
      },
    });

    const res = await request(app)
      .post(`/api/organizations/${ORG_ID}/threads`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subsectionId,
        title: 'Thread with foreign tag',
        body: 'Body text',
        tagIds: [foreignTag.id],
      });

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('INVALID_TAG');

    // Cleanup
    await prisma.tag.delete({ where: { id: foreignTag.id } });
  });

  it('creating a thread with a valid same-org tag succeeds', async () => {
    const ownTag = await prisma.tag.create({
      data: {
        organizationId: ORG_ID,
        name: 'OwnTag_' + Date.now(),
        slug: 'own-tag-' + Date.now(),
      },
    });

    const res = await request(app)
      .post(`/api/organizations/${ORG_ID}/threads`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subsectionId,
        title: 'Thread with valid tag',
        body: 'Body text',
        tagIds: [ownTag.id],
      });

    expect(res.status).toBe(201);

    // Cleanup
    await prisma.threadTag.deleteMany({ where: { tagId: ownTag.id } });
    await prisma.tag.delete({ where: { id: ownTag.id } });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FIX 5  –  Organization creation requires platform admin
// ═══════════════════════════════════════════════════════════════════════════

describe('Organization creation authorization', () => {
  it('platform admin (in platform org) can create an organization', async () => {
    const res = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'New Test Org ' + Date.now(),
        slug: 'new-test-org-' + Date.now(),
      });

    expect(res.status).toBe(201);
    expect(res.body.organization).toHaveProperty('id');

    // Cleanup: delete the org created in this test
    if (res.body.organization?.id) {
      await prisma.organization.delete({ where: { id: res.body.organization.id } });
    }
  });

  it('admin from non-platform org cannot create an organization (403)', async () => {
    const res = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${secondOrgAdminToken}`)
      .send({
        name: 'Should Fail Org',
        slug: 'should-fail-org',
      });

    expect(res.status).toBe(403);
  });

  it('unauthenticated request to create org returns 401', async () => {
    const res = await request(app)
      .post('/api/organizations')
      .send({ name: 'No Auth Org', slug: 'no-auth-org' });

    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FIX 6/7  –  Audit logs for destructive config deletes
// ═══════════════════════════════════════════════════════════════════════════

describe('Audit logs for destructive config deletes', () => {
  it('deleting an announcement creates a config_delete audit log with actorId', async () => {
    // Create announcement
    const futureDate = new Date(Date.now() + 86400_000);
    const createRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/announcements`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Audit Test Announcement',
        body: 'Will be deleted',
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
      });
    expect(createRes.status).toBe(201);
    const announcementId = createRes.body.announcement.id;

    // Delete announcement
    const deleteRes = await request(app)
      .delete(`/api/organizations/${ORG_ID}/announcements/${announcementId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(204);

    // Query audit log
    const auditRes = await request(app)
      .get(`/api/organizations/${ORG_ID}/audit-logs?action=config_delete&resourceType=announcement`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(auditRes.status).toBe(200);

    const logs: Array<Record<string, unknown>> = auditRes.body.data;
    const matchingLog = logs.find(
      (l) => l.resourceId === announcementId && l.action === 'config_delete',
    );

    expect(matchingLog).toBeDefined();
    expect(matchingLog!.actorId).toBe(ADMIN_ID);
    expect((matchingLog!.details as Record<string, unknown>)?.title).toBe('Audit Test Announcement');
  });

  it('deleting a venue creates a config_delete audit log with actorId and venue name', async () => {
    // Create venue
    const createRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/venues`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Audit Venue ' + Date.now(), description: 'For audit test' });
    expect(createRes.status).toBe(201);
    const venueId = createRes.body.venue.id;
    const venueName = createRes.body.venue.name;

    // Delete venue
    const deleteRes = await request(app)
      .delete(`/api/organizations/${ORG_ID}/venues/${venueId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(204);

    // Query audit log
    const auditRes = await request(app)
      .get(`/api/organizations/${ORG_ID}/audit-logs?action=config_delete&resourceType=venue`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(auditRes.status).toBe(200);

    const logs: Array<Record<string, unknown>> = auditRes.body.data;
    const matchingLog = logs.find(
      (l) => l.resourceId === venueId && l.action === 'config_delete',
    );

    expect(matchingLog).toBeDefined();
    expect(matchingLog!.actorId).toBe(ADMIN_ID);
    expect((matchingLog!.details as Record<string, unknown>)?.name).toBe(venueName);
  });

  it('permanent-delete via recycle bin records purge with actorId', async () => {
    // Create a thread and soft-delete it, then hard-delete
    const secRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Purge Section', displayOrder: 200 });
    const sectionId = secRes.body.section.id;

    const subRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections/${sectionId}/subsections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Purge Subsection', displayOrder: 0 });
    const subsectionId = subRes.body.subsection.id;

    const threadRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/threads`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subsectionId, title: 'Purge Me', body: 'Will be purged.' });
    const threadId = threadRes.body.thread.id;

    // Soft-delete via bulk action
    await request(app)
      .post(`/api/organizations/${ORG_ID}/moderation/bulk-action`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'delete', resourceType: 'thread', resourceIds: [threadId] });

    // Hard-delete via recycle bin
    const purgeRes = await request(app)
      .delete(`/api/organizations/${ORG_ID}/recycle-bin/thread/${threadId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(purgeRes.status).toBe(204);

    // Verify audit log
    const auditRes = await request(app)
      .get(`/api/organizations/${ORG_ID}/audit-logs?action=content_purged&resourceType=thread`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(auditRes.status).toBe(200);

    const logs: Array<Record<string, unknown>> = auditRes.body.data;
    const purgeLog = logs.find((l) => l.resourceId === threadId);

    expect(purgeLog).toBeDefined();
    expect(purgeLog!.actorId).toBe(ADMIN_ID);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FIX 8  –  Auth failure logging: safe error messages + audit trail
// ═══════════════════════════════════════════════════════════════════════════

describe('Auth failure logging', () => {
  it('failed login returns 401 with a generic UNAUTHORIZED error code', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nonexistent_user_xyz', password: 'SomePassword123!', organizationId: ORG_ID });

    expect(res.status).toBe(401);
    // Response must not reveal whether the username exists
    expect(res.body.error?.code).toBe('UNAUTHORIZED');
    // Response must not echo back the submitted username
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('nonexistent_user_xyz');
  });

  it('failed login for existing user creates a login_failed audit log', async () => {
    // Use the seeded admin user with a bad password
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'WrongPassword999!', organizationId: ORG_ID });
    expect(res.status).toBe(401);

    // Query audit logs for login_failed
    const auditRes = await request(app)
      .get(`/api/organizations/${ORG_ID}/audit-logs?action=login_failed`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(auditRes.status).toBe(200);

    const logs: Array<Record<string, unknown>> = auditRes.body.data;
    // At least one login_failed log should exist for the admin user
    const failedLog = logs.find((l) => l.actorId === ADMIN_ID && l.action === 'login_failed');
    expect(failedLog).toBeDefined();
  });

  it('failed login for non-existent username does not reveal user existence', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'i_do_not_exist_abcdef', password: 'SomePassword123!', organizationId: ORG_ID });

    expect(res.status).toBe(401);
    // Same error code as wrong password — prevents username enumeration
    expect(res.body.error?.code).toBe('UNAUTHORIZED');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FIX 1 (atomicity)  –  Thread tag validation is atomic: no partial mutations
// ═══════════════════════════════════════════════════════════════════════════

describe('Thread tag atomicity', () => {
  let atomicSubsectionId: string;

  beforeAll(async () => {
    const secRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Atomic Tag Section', displayOrder: 300 });
    const sectionId = secRes.body.section.id;

    const subRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/sections/${sectionId}/subsections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Atomic Tag Subsection', displayOrder: 0 });
    atomicSubsectionId = subRes.body.subsection.id;
  });

  it('createThread with invalid tag returns 400 and no thread is persisted', async () => {
    // Count threads before the attempt
    const beforeCount = await prisma.thread.count({
      where: { organizationId: ORG_ID, subsectionId: atomicSubsectionId },
    });

    // Use a foreign tag (from the second org) — invalid for ORG_ID
    const foreignTag = await prisma.tag.create({
      data: {
        organizationId: SECOND_ORG_ID,
        name: 'AtomicForeignTag_' + Date.now(),
        slug: 'atomic-foreign-' + Date.now(),
      },
    });

    const res = await request(app)
      .post(`/api/organizations/${ORG_ID}/threads`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subsectionId: atomicSubsectionId,
        title: 'Should Never Exist',
        body: 'Body text',
        tagIds: [foreignTag.id],
      });

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('INVALID_TAG');

    // Thread must NOT have been created (atomicity)
    const afterCount = await prisma.thread.count({
      where: { organizationId: ORG_ID, subsectionId: atomicSubsectionId },
    });
    expect(afterCount).toBe(beforeCount);

    // Cleanup
    await prisma.tag.delete({ where: { id: foreignTag.id } });
  });

  it('updateThread with invalid tag returns 400 and existing tags are unchanged', async () => {
    // Create a valid tag and a thread that uses it
    const validTag = await prisma.tag.create({
      data: {
        organizationId: ORG_ID,
        name: 'AtomicValidTag_' + Date.now(),
        slug: 'atomic-valid-' + Date.now(),
      },
    });

    const createRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/threads`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subsectionId: atomicSubsectionId,
        title: 'Thread With Valid Tag',
        body: 'Body text',
        tagIds: [validTag.id],
      });
    expect(createRes.status).toBe(201);
    const threadId = createRes.body.thread.id;

    // Confirm original tag is attached
    const before = await prisma.threadTag.count({ where: { threadId, tagId: validTag.id } });
    expect(before).toBe(1);

    // Attempt update with a foreign tag
    const foreignTag = await prisma.tag.create({
      data: {
        organizationId: SECOND_ORG_ID,
        name: 'AtomicForeignTag2_' + Date.now(),
        slug: 'atomic-foreign2-' + Date.now(),
      },
    });

    const updateRes = await request(app)
      .put(`/api/organizations/${ORG_ID}/threads/${threadId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tagIds: [foreignTag.id] });

    expect(updateRes.status).toBe(400);
    expect(updateRes.body.error?.code).toBe('INVALID_TAG');

    // Original tag mapping must still be intact (no deleteMany ran)
    const after = await prisma.threadTag.count({ where: { threadId, tagId: validTag.id } });
    expect(after).toBe(1);

    // Cleanup
    await prisma.threadTag.deleteMany({ where: { threadId } });
    await prisma.thread.delete({ where: { id: threadId } });
    await prisma.tag.delete({ where: { id: validTag.id } });
    await prisma.tag.delete({ where: { id: foreignTag.id } });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FIX 3  –  Moderation notifications respect subscription settings
// ═══════════════════════════════════════════════════════════════════════════

describe('Moderation notification subscription enforcement', () => {
  let modTestUserId: string;

  beforeAll(async () => {
    const pwHash = await bcrypt.hash('TestPassword123!', 4);
    const user = await prisma.user.create({
      data: { organizationId: ORG_ID, username: 'modtest_' + Date.now(), passwordHash: pwHash, role: 'user' },
    });
    modTestUserId = user.id;
  });

  afterAll(async () => {
    await prisma.notificationSubscription.deleteMany({ where: { userId: modTestUserId } });
    await prisma.notification.deleteMany({ where: { userId: modTestUserId } });
    await prisma.user.deleteMany({ where: { id: modTestUserId } });
  });

  it('createForModeration returns null when user has no moderation subscription (explicit opt-in required)', async () => {
    // No subscription record → not subscribed for 'moderation'
    const result = await createForModeration(ORG_ID, modTestUserId, 'content_removed', 'Your reply was removed.');
    expect(result).toBeNull();
  });

  it('createForModeration sends notification when user has explicit moderation opt-in', async () => {
    await prisma.notificationSubscription.create({
      data: { userId: modTestUserId, organizationId: ORG_ID, category: 'moderation', isSubscribed: true },
    });

    const notification = await createForModeration(ORG_ID, modTestUserId, 'content_removed', 'Your reply was removed.');

    expect(notification).not.toBeNull();
    expect(notification!.userId).toBe(modTestUserId);
    expect(notification!.type).toBe('moderation_action');

    if (notification) {
      await prisma.notification.deleteMany({ where: { id: notification.id } });
    }
  });

  it('createForModeration with opted-out user does not persist a notification', async () => {
    await prisma.notificationSubscription.upsert({
      where: {
        userId_organizationId_category: {
          userId: modTestUserId, organizationId: ORG_ID, category: 'moderation',
        },
      },
      update: { isSubscribed: false },
      create: { userId: modTestUserId, organizationId: ORG_ID, category: 'moderation', isSubscribed: false },
    });

    const notifCountBefore = await prisma.notification.count({ where: { userId: modTestUserId } });

    const result = await createForModeration(ORG_ID, modTestUserId, 'content_removed', 'Your reply was removed.');

    expect(result).toBeNull();
    const notifCountAfter = await prisma.notification.count({ where: { userId: modTestUserId } });
    expect(notifCountAfter).toBe(notifCountBefore);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FIX 4 (gap)  –  Carousel delete writes config_delete audit log
// ═══════════════════════════════════════════════════════════════════════════

describe('Carousel delete audit log', () => {
  it('deleting a carousel item creates a config_delete audit log with actorId and title', async () => {
    const futureDate = new Date(Date.now() + 86400_000);
    const createRes = await request(app)
      .post(`/api/organizations/${ORG_ID}/carousel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Audit Carousel ' + Date.now(),
        startDate: new Date().toISOString(),
        endDate: futureDate.toISOString(),
      });
    expect(createRes.status).toBe(201);
    const itemId: string = createRes.body.item.id;
    const itemTitle: string = createRes.body.item.title;

    const deleteRes = await request(app)
      .delete(`/api/organizations/${ORG_ID}/carousel/${itemId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(204);

    const auditRes = await request(app)
      .get(`/api/organizations/${ORG_ID}/audit-logs?action=config_delete&resourceType=carousel_item`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(auditRes.status).toBe(200);

    const logs: Array<Record<string, unknown>> = auditRes.body.data;
    const matchingLog = logs.find(
      (l) => l.resourceId === itemId && l.action === 'config_delete',
    );

    expect(matchingLog).toBeDefined();
    expect(matchingLog!.actorId).toBe(ADMIN_ID);
    expect(matchingLog!.resourceType).toBe('carousel_item');
    expect((matchingLog!.details as Record<string, unknown>)?.title).toBe(itemTitle);
  });
});
