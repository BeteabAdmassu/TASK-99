/**
 * Central application configuration contract.
 *
 * Runtime behaviour is driven by DB feature flags scoped to the platform org.
 * Environment variables provide bootstrap/safe defaults used when a flag is absent or invalid.
 * All flag changes go through the feature-flags API, which records an audit log entry for
 * every create/update/delete, ensuring every configuration change is fully traceable.
 *
 * To override a default, create or update a feature flag via:
 *   POST /api/organizations/:platformOrgId/feature-flags
 *   PATCH /api/organizations/:platformOrgId/feature-flags/:flagId
 */
import { logger } from './logger';
import { env } from './env';
import { prisma } from './database';

export interface AppConfig {
  /** Maximum pinned threads allowed per forum section (default: 3) */
  maxPinnedThreadsPerSection: number;
  /** Maximum reply nesting depth; depth 1 = direct reply (default: 3) */
  maxReplyDepth: number;
  /** When false, the notification retry cron job skips execution (default: true) */
  notificationRetryEnabled: boolean;
  /** When false, the anomaly detection cron job skips execution (default: true) */
  anomalyDetectionEnabled: boolean;
}

/**
 * Canonical DB feature-flag keys for runtime configuration.
 * Create these flags in the platform org to override the defaults documented above.
 */
export const CONFIG_FLAG_KEYS = {
  MAX_PINNED_THREADS: 'max_pinned_threads_per_section',
  MAX_REPLY_DEPTH: 'max_reply_depth',
  NOTIFICATION_RETRY_ENABLED: 'notification_retry_enabled',
  ANOMALY_DETECTION_ENABLED: 'anomaly_detection_enabled',
} as const;

/** Safe fallbacks used when a DB flag is absent or cannot be parsed. */
const DEFAULTS: AppConfig = {
  maxPinnedThreadsPerSection: 3,
  maxReplyDepth: 3,
  notificationRetryEnabled: true,
  anomalyDetectionEnabled: true,
};

/** Look up a single feature flag. Returns `defaultValue` on missing flag or DB error. */
async function readFlag<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const flag = await prisma.featureFlag.findFirst({
      where: { organizationId: env.PLATFORM_ORG_ID, flagKey: key },
    });
    if (!flag || flag.value === null || flag.value === undefined) {
      return defaultValue;
    }
    return flag.value as T;
  } catch (err) {
    logger.warn({ key, err }, 'appConfig: feature-flag lookup failed, using default');
    return defaultValue;
  }
}

/**
 * Load the current application configuration from DB feature flags.
 * Missing or invalid flags fall back to the safe defaults defined in DEFAULTS.
 * This function is safe to call from scheduled jobs and middleware.
 */
export async function getAppConfig(): Promise<AppConfig> {
  const [
    maxPinnedThreads,
    maxReplyDepth,
    notificationRetryEnabled,
    anomalyDetectionEnabled,
  ] = await Promise.all([
    readFlag<number>(CONFIG_FLAG_KEYS.MAX_PINNED_THREADS, DEFAULTS.maxPinnedThreadsPerSection),
    readFlag<number>(CONFIG_FLAG_KEYS.MAX_REPLY_DEPTH, DEFAULTS.maxReplyDepth),
    readFlag<boolean>(CONFIG_FLAG_KEYS.NOTIFICATION_RETRY_ENABLED, DEFAULTS.notificationRetryEnabled),
    readFlag<boolean>(CONFIG_FLAG_KEYS.ANOMALY_DETECTION_ENABLED, DEFAULTS.anomalyDetectionEnabled),
  ]);

  return {
    maxPinnedThreadsPerSection: Math.max(1, Number(maxPinnedThreads) || DEFAULTS.maxPinnedThreadsPerSection),
    maxReplyDepth: Math.max(1, Number(maxReplyDepth) || DEFAULTS.maxReplyDepth),
    // Treat any non-false value as enabled so a missing flag defaults to on
    notificationRetryEnabled: notificationRetryEnabled !== false,
    anomalyDetectionEnabled: anomalyDetectionEnabled !== false,
  };
}
