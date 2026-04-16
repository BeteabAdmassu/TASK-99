/**
 * Integration tests for background scheduled jobs.
 *
 * Each job function is invoked directly against the real DB so we can verify
 * side effects (rows created, updated, deleted) without waiting for cron.
 */

import bcrypt from 'bcryptjs';
import { prisma } from '../../src/config/database';
import { muteExpiryJob } from '../../src/jobs/muteExpiry';
import { tokenCleanupJob } from '../../src/jobs/tokenCleanup';
import { recycleBinPurge } from '../../src/jobs/recycleBinPurge';

const ORG_ID = '00000000-0000-0000-0000-000000000001';

// ─── Helpers ──────────────────────────────────────────────────────────────

async function createTestUser(suffix: string, overrides: Record<string, unknown> = {}) {
  const passwordHash = await bcrypt.hash('TestPassword123!', 4);
  return prisma.user.create({
    data: {
      organizationId: ORG_ID,
      username: `job_test_${suffix}_${Date.now()}`,
      passwordHash,
      role: 'user',
      ...overrides,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// muteExpiryJob
// ═══════════════════════════════════════════════════════════════════════════

describe('muteExpiryJob', () => {
  let expiredMuteUserId: string;
  let futureMuteUserId: string;
  let unmutedUserId: string;

  beforeAll(async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    const expiredUser = await createTestUser('expired_mute', {
      isMuted: true,
      mutedUntil: pastDate,
      mutedBy: '00000000-0000-0000-0000-000000000002',
      muteReason: 'test expired',
    });
    expiredMuteUserId = expiredUser.id;

    const futureUser = await createTestUser('future_mute', {
      isMuted: true,
      mutedUntil: futureDate,
      mutedBy: '00000000-0000-0000-0000-000000000002',
      muteReason: 'test future',
    });
    futureMuteUserId = futureUser.id;

    const normalUser = await createTestUser('unmuted');
    unmutedUserId = normalUser.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [expiredMuteUserId, futureMuteUserId, unmutedUserId] } },
    });
  });

  it('clears expired mutes (mutedUntil in the past)', async () => {
    await muteExpiryJob();

    const user = await prisma.user.findUnique({ where: { id: expiredMuteUserId } });
    expect(user!.isMuted).toBe(false);
    expect(user!.mutedUntil).toBeNull();
    expect(user!.mutedBy).toBeNull();
    expect(user!.muteReason).toBeNull();
  });

  it('does NOT clear mutes that have not expired yet', async () => {
    await muteExpiryJob();

    const user = await prisma.user.findUnique({ where: { id: futureMuteUserId } });
    expect(user!.isMuted).toBe(true);
    expect(user!.mutedUntil).not.toBeNull();
  });

  it('does not affect unmuted users', async () => {
    await muteExpiryJob();

    const user = await prisma.user.findUnique({ where: { id: unmutedUserId } });
    expect(user!.isMuted).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// tokenCleanupJob
// ═══════════════════════════════════════════════════════════════════════════

describe('tokenCleanupJob', () => {
  const expiredJti = 'expired-tokenJti-' + Date.now();
  const validJti = 'valid-tokenJti-' + Date.now();

  beforeAll(async () => {
    await prisma.tokenBlacklist.createMany({
      data: [
        { tokenJti: expiredJti, expiresAt: new Date(Date.now() - 60_000) },
        { tokenJti: validJti, expiresAt: new Date(Date.now() + 86400_000) },
      ],
    });
  });

  afterAll(async () => {
    await prisma.tokenBlacklist.deleteMany({
      where: { tokenJti: { in: [expiredJti, validJti] } },
    });
  });

  it('removes expired tokens from the blacklist', async () => {
    await tokenCleanupJob();

    const expired = await prisma.tokenBlacklist.findUnique({ where: { tokenJti: expiredJti } });
    expect(expired).toBeNull();
  });

  it('keeps valid (future-expiry) tokens', async () => {
    await tokenCleanupJob();

    const valid = await prisma.tokenBlacklist.findUnique({ where: { tokenJti: validJti } });
    expect(valid).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// recycleBinPurge
// ═══════════════════════════════════════════════════════════════════════════

describe('recycleBinPurge', () => {
  let oldDeletedThreadId: string;
  let recentDeletedThreadId: string;
  let subsectionId: string;

  beforeAll(async () => {
    // Create a subsection for the test threads
    const section = await prisma.forumSection.create({
      data: { organizationId: ORG_ID, name: 'Purge Job Section ' + Date.now(), displayOrder: 999 },
    });
    const subsection = await prisma.forumSubsection.create({
      data: { sectionId: section.id, organizationId: ORG_ID, name: 'Purge Job Sub', displayOrder: 0 },
    });
    subsectionId = subsection.id;

    const adminId = '00000000-0000-0000-0000-000000000002';
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    const oldThread = await prisma.thread.create({
      data: {
        organizationId: ORG_ID,
        subsectionId,
        authorId: adminId,
        title: 'Old Deleted Thread',
        body: 'Should be purged',
        deletedAt: thirtyOneDaysAgo,
        deletedBy: adminId,
      },
    });
    oldDeletedThreadId = oldThread.id;

    const recentThread = await prisma.thread.create({
      data: {
        organizationId: ORG_ID,
        subsectionId,
        authorId: adminId,
        title: 'Recent Deleted Thread',
        body: 'Should NOT be purged',
        deletedAt: fiveDaysAgo,
        deletedBy: adminId,
      },
    });
    recentDeletedThreadId = recentThread.id;
  });

  afterAll(async () => {
    // Clean up any remaining test data
    await prisma.thread.deleteMany({
      where: { id: { in: [oldDeletedThreadId, recentDeletedThreadId] } },
    });
    await prisma.forumSubsection.deleteMany({ where: { id: subsectionId } });
  });

  it('purges threads soft-deleted more than 30 days ago', async () => {
    await recycleBinPurge();

    const purged = await prisma.thread.findUnique({ where: { id: oldDeletedThreadId } });
    expect(purged).toBeNull();
  });

  it('does NOT purge threads soft-deleted less than 30 days ago', async () => {
    // recycleBinPurge was already called above; just verify retention
    const retained = await prisma.thread.findUnique({ where: { id: recentDeletedThreadId } });
    expect(retained).not.toBeNull();
  });
});
