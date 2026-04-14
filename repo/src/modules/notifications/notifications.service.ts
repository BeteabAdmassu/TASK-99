import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { NotFoundError } from '../../utils/errors';
import { parsePagination, buildPaginatedResponse } from '../../utils/pagination';

interface CreateNotificationData {
  orgId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  referenceType?: string;
  referenceId?: string;
  scheduledAt?: string | Date;
}

interface NotificationFilters {
  status?: string;
}

interface PaginationInput {
  page?: string | number;
  limit?: string | number;
}

/** Check whether a user is effectively subscribed to a notification category.
 *  - 'security' category is always subscribed (cannot be opted out).
 *  - All other categories require an explicit opt-in record (default: not subscribed).
 */
async function isUserSubscribed(orgId: string, userId: string, category: string): Promise<boolean> {
  if (category === 'security') return true;

  const sub = await prisma.notificationSubscription.findUnique({
    where: {
      userId_organizationId_category: {
        userId,
        organizationId: orgId,
        category,
      },
    },
  });

  // No explicit record → not subscribed (explicit opt-in required for non-security categories)
  return sub !== null && sub.isSubscribed;
}

export async function createNotification(data: CreateNotificationData) {
  const now = new Date();
  const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
  const isFutureScheduled = scheduledAt !== null && scheduledAt > now;

  const notification = await prisma.notification.create({
    data: {
      organizationId: data.orgId,
      userId: data.userId,
      type: data.type,
      title: data.title,
      body: data.body,
      referenceType: data.referenceType ?? null,
      referenceId: data.referenceId ?? null,
      scheduledAt,
      status: 'pending',
    },
  });

  // Only attempt immediate delivery for unscheduled or already-due notifications.
  // Future-scheduled notifications remain pending until the scheduler processes them.
  if (!isFutureScheduled) {
    try {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'delivered',
          deliveredAt: now,
        },
      });

      logger.info({ notificationId: notification.id, userId: data.userId }, 'Notification delivered');
    } catch (error) {
      logger.warn({ notificationId: notification.id, error }, 'Notification delivery failed, left as pending');
    }
  }

  return notification;
}

export async function createForNewReply(
  orgId: string,
  threadId: string,
  replyAuthorId: string,
  replyId: string,
) {
  const thread = await prisma.thread.findFirst({
    where: { id: threadId, organizationId: orgId },
  });

  if (!thread) {
    logger.warn({ threadId, orgId }, 'Thread not found for reply notification');
    return null;
  }

  // Don't notify if the reply author is the thread author
  if (thread.authorId === replyAuthorId) {
    return null;
  }

  // Respect subscription preference for 'forum' category
  const subscribed = await isUserSubscribed(orgId, thread.authorId, 'forum');
  if (!subscribed) {
    logger.info({ userId: thread.authorId, category: 'forum' }, 'Notification suppressed: user opted out');
    return null;
  }

  const notification = await createNotification({
    orgId,
    userId: thread.authorId,
    type: 'new_reply',
    title: 'New reply to your thread',
    body: `Someone replied to your thread "${thread.title}"`,
    referenceType: 'reply',
    referenceId: replyId,
  });

  return notification;
}

export async function createForModeration(
  orgId: string,
  userId: string,
  action: string,
  details: string | Record<string, unknown>,
) {
  // Moderation notifications use the 'moderation' category and respect the user's
  // subscription preference. If the platform needs specific moderation actions to be
  // mandatory, those callers should invoke createNotification directly with type
  // 'security_alert' instead of going through this helper.
  const subscribed = await isUserSubscribed(orgId, userId, 'moderation');
  if (!subscribed) {
    logger.info({ userId, category: 'moderation' }, 'Notification suppressed: user opted out of moderation');
    return null;
  }

  const body = typeof details === 'string' ? details : JSON.stringify(details);
  const notification = await createNotification({
    orgId,
    userId,
    type: 'moderation_action',
    title: `Moderation action: ${action}`,
    body,
    referenceType: 'moderation',
  });

  return notification;
}

export async function createForAnnouncement(
  orgId: string,
  announcementId: string,
  title: string,
) {
  // Find all users in the organization
  const users = await prisma.user.findMany({
    where: { organizationId: orgId },
    select: { id: true },
  });

  const notifications = [];

  for (const user of users) {
    // Respect subscription preference for 'announcement' category
    const subscribed = await isUserSubscribed(orgId, user.id, 'announcement');
    if (!subscribed) {
      continue;
    }

    try {
      const notification = await createNotification({
        orgId,
        userId: user.id,
        type: 'announcement',
        title: 'New Announcement',
        body: title,
        referenceType: 'announcement',
        referenceId: announcementId,
      });
      notifications.push(notification);
    } catch (error) {
      logger.warn({ userId: user.id, announcementId, error }, 'Failed to create announcement notification');
    }
  }

  logger.info({ orgId, announcementId, count: notifications.length }, 'Announcement notifications created');

  return notifications;
}

export async function listNotifications(
  orgId: string,
  userId: string,
  filters: NotificationFilters,
  pagination: PaginationInput,
) {
  const { skip, take, page, limit } = parsePagination(pagination);

  const where: Record<string, unknown> = {
    organizationId: orgId,
    userId,
  };

  if (filters.status) {
    where.status = filters.status;
  }

  const [data, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: {
        organizationId: orgId,
        userId,
        status: { not: 'read' },
      },
    }),
  ]);

  const paginated = buildPaginatedResponse(data, total, page, limit);

  return {
    ...paginated,
    unreadCount,
  };
}

export async function markRead(
  orgId: string,
  notificationId: string,
  userId: string,
) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, organizationId: orgId, userId },
  });

  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: 'read',
      readAt: new Date(),
    },
  });

  return updated;
}

export async function markAllRead(orgId: string, userId: string) {
  const result = await prisma.notification.updateMany({
    where: {
      organizationId: orgId,
      userId,
      status: { not: 'read' },
    },
    data: {
      status: 'read',
      readAt: new Date(),
    },
  });

  logger.info({ orgId, userId, count: result.count }, 'All notifications marked as read');

  return { count: result.count };
}

export async function processRetries() {
  const failedNotifications = await prisma.notification.findMany({
    where: {
      status: 'failed',
      retryCount: { lt: 3 },
    },
  });

  let successCount = 0;
  let failCount = 0;

  for (const notification of failedNotifications) {
    try {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'delivered',
          deliveredAt: new Date(),
        },
      });
      successCount++;
    } catch (error) {
      const newRetryCount = notification.retryCount + 1;
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          retryCount: newRetryCount,
          lastRetryAt: new Date(),
        },
      });
      failCount++;
      logger.warn(
        { notificationId: notification.id, retryCount: newRetryCount },
        'Notification retry failed',
      );
    }
  }

  logger.info({ successCount, failCount, total: failedNotifications.length }, 'Notification retries processed');

  return { successCount, failCount, total: failedNotifications.length };
}

export async function processScheduled() {
  const now = new Date();

  const scheduledNotifications = await prisma.notification.findMany({
    where: {
      status: 'pending',
      scheduledAt: { lte: now },
    },
  });

  let processedCount = 0;

  for (const notification of scheduledNotifications) {
    try {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'delivered',
          deliveredAt: now,
        },
      });
      processedCount++;
    } catch (error) {
      logger.warn(
        { notificationId: notification.id, error },
        'Failed to process scheduled notification',
      );
    }
  }

  logger.info({ processedCount, total: scheduledNotifications.length }, 'Scheduled notifications processed');

  return { processedCount, total: scheduledNotifications.length };
}
