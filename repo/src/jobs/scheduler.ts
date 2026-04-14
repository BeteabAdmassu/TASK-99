import cron from 'node-cron';
import { logger } from '../config/logger';
import { getAppConfig } from '../config/appConfig';
import { recycleBinPurge } from './recycleBinPurge';
import { notificationRetry } from './notificationRetry';
import { processScheduledNotifications } from './notificationScheduled';
import { anomalyDetectionJob } from './anomalyDetection';
import { muteExpiryJob } from './muteExpiry';
import { tokenCleanupJob } from './tokenCleanup';
import { backupJob } from './backup';

const tasks: cron.ScheduledTask[] = [];

function scheduleJob(name: string, schedule: string, handler: () => Promise<void> | void): void {
  const task = cron.schedule(schedule, async () => {
    try {
      await handler();
    } catch (err) {
      logger.error({ err, job: name }, `Scheduled job "${name}" failed`);
    }
  });
  tasks.push(task);
  logger.info({ job: name, schedule }, 'Scheduled job registered');
}

export function startScheduler(): void {
  scheduleJob('recycleBinPurge', '0 3 * * *', recycleBinPurge);

  // notificationRetry: check DB feature flag before each execution
  scheduleJob('notificationRetry', '*/2 * * * *', async () => {
    const cfg = await getAppConfig();
    if (!cfg.notificationRetryEnabled) {
      logger.info({ job: 'notificationRetry' }, 'Job skipped: disabled via feature flag');
      return;
    }
    await notificationRetry();
  });

  scheduleJob('scheduledNotifications', '*/1 * * * *', processScheduledNotifications);

  // anomalyDetection: check DB feature flag before each execution
  scheduleJob('anomalyDetection', '*/5 * * * *', async () => {
    const cfg = await getAppConfig();
    if (!cfg.anomalyDetectionEnabled) {
      logger.info({ job: 'anomalyDetection' }, 'Job skipped: disabled via feature flag');
      return;
    }
    await anomalyDetectionJob();
  });

  scheduleJob('muteExpiry', '*/5 * * * *', muteExpiryJob);
  scheduleJob('tokenCleanup', '0 * * * *', tokenCleanupJob);
  scheduleJob('backup', '0 2 * * *', backupJob);
  logger.info('All scheduled jobs registered');
}

export function stopScheduler(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks.length = 0;
  logger.info('All scheduled jobs stopped');
}
