import { prisma } from '../config/database';
import { logger } from '../config/logger';

export async function muteExpiryJob(): Promise<void> {
  const now = new Date();

  const result = await prisma.user.updateMany({
    where: {
      isMuted: true,
      mutedUntil: { lt: now },
    },
    data: {
      isMuted: false,
      mutedUntil: null,
      mutedBy: null,
      muteReason: null,
    },
  });

  if (result.count > 0) {
    logger.info({ count: result.count }, 'Expired mutes cleared');
  }
}
