import { prisma } from '../config/database';
import { logger } from '../config/logger';

export async function processScheduledNotifications(): Promise<void> {
  const now = new Date();

  const result = await prisma.notification.updateMany({
    where: {
      status: 'pending',
      scheduledAt: { lte: now },
    },
    data: {
      status: 'delivered',
      deliveredAt: now,
    },
  });

  if (result.count > 0) {
    logger.info({ count: result.count }, 'Scheduled notifications delivered');
  }
}
