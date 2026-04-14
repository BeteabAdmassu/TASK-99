import { prisma } from '../config/database';
import { logger } from '../config/logger';

export async function recycleBinPurge(): Promise<void> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const deletedThreads = await prisma.thread.deleteMany({
    where: {
      deletedAt: { not: null, lt: thirtyDaysAgo },
    },
  });

  const deletedReplies = await prisma.reply.deleteMany({
    where: {
      deletedAt: { not: null, lt: thirtyDaysAgo },
    },
  });

  logger.info(
    { purgedThreads: deletedThreads.count, purgedReplies: deletedReplies.count },
    'Recycle bin purge completed',
  );
}
