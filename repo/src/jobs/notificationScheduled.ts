import { processScheduled } from '../modules/notifications/notifications.service';

/**
 * Scheduled job: deliver notifications whose scheduledAt time has arrived.
 * Delegates to the service's shared delivery pipeline so failures are consistently
 * transitioned to failed state and picked up by the retry job.
 */
export async function processScheduledNotifications(): Promise<void> {
  await processScheduled();
}
