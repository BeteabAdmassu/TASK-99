import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

export async function listSubscriptions(orgId: string, userId: string) {
  const subscriptions = await prisma.notificationSubscription.findMany({
    where: {
      organizationId: orgId,
      userId,
    },
  });

  return subscriptions;
}

export async function updateSubscription(
  orgId: string,
  userId: string,
  category: string,
  isSubscribed: boolean,
) {
  // Security category must always be subscribed
  const finalIsSubscribed = category === 'security' ? true : isSubscribed;

  const subscription = await prisma.notificationSubscription.upsert({
    where: {
      userId_organizationId_category: {
        userId,
        organizationId: orgId,
        category,
      },
    },
    update: {
      isSubscribed: finalIsSubscribed,
    },
    create: {
      userId,
      organizationId: orgId,
      category,
      isSubscribed: finalIsSubscribed,
    },
  });

  logger.info(
    { orgId, userId, category, isSubscribed: finalIsSubscribed },
    'Subscription updated',
  );

  return subscription;
}
