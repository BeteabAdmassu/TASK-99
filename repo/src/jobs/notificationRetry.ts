import { processRetries } from '../modules/notifications/notifications.service';

/**
 * Scheduled job: retry failed notifications.
 * All retry logic (backoff, 24h window, terminal state) lives in processRetries()
 * to maintain a single delivery pipeline shared with immediate and scheduled delivery.
 */
export async function notificationRetry(): Promise<void> {
  await processRetries();
}
