import { prisma } from '../config/database';
import { logger } from '../config/logger';

export async function notificationRetry(): Promise<void> {
  const now = new Date();

  // Find failed notifications that need retry (retryCount < 3)
  const failedNotifications = await prisma.notification.findMany({
    where: {
      status: 'failed',
      retryCount: { lt: 3 },
    },
    take: 100,
  });

  let processed = 0;
  let failed = 0;

  for (const notification of failedNotifications) {
    // Exponential backoff: 1min, 4min, 16min
    const backoffMs = Math.pow(4, notification.retryCount) * 60 * 1000;
    const lastRetry = notification.lastRetryAt || notification.createdAt;
    if (now.getTime() - lastRetry.getTime() < backoffMs) continue;

    // Check within 24hr window
    if (now.getTime() - notification.createdAt.getTime() > 24 * 60 * 60 * 1000) continue;

    try {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'delivered',
          deliveredAt: now,
          lastRetryAt: now,
          retryCount: notification.retryCount + 1,
        },
      });
      processed++;
    } catch {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          retryCount: notification.retryCount + 1,
          lastRetryAt: now,
        },
      }).catch(() => {});
      failed++;
    }
  }

  if (processed > 0 || failed > 0) {
    logger.info({ processed, failed }, 'Notification retry completed');
  }
}
