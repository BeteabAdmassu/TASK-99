import { prisma } from '../config/database';
import { logger } from '../config/logger';

export async function tokenCleanupJob(): Promise<void> {
  const now = new Date();

  const result = await prisma.tokenBlacklist.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  });

  if (result.count > 0) {
    logger.info({ count: result.count }, 'Expired token blacklist entries cleaned');
  }
}
