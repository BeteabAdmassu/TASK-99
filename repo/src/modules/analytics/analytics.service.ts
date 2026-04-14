import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

interface FunnelMetricsPeriod {
  period: string;
  views: number;
  registrations: number;
  posts: number;
  engagements: number;
}

interface FunnelMetricsResult {
  metrics: {
    views: number;
    registrations: number;
    posts: number;
    engagements: number;
    periods: FunnelMetricsPeriod[];
  };
}

export async function getFunnelMetrics(
  orgId: string,
  startDate?: string,
  endDate?: string,
  granularity?: string,
): Promise<FunnelMetricsResult> {
  const gran = granularity || 'day';
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  // Determine the SQL date format based on granularity
  let dateFormat: string;
  switch (gran) {
    case 'hour':
      dateFormat = '%Y-%m-%d %H:00';
      break;
    case 'week':
      dateFormat = '%x-W%v';
      break;
    case 'month':
      dateFormat = '%Y-%m';
      break;
    case 'day':
    default:
      dateFormat = '%Y-%m-%d';
      break;
  }

  // Use raw SQL for grouping by date periods with event types
  const rawResults = await prisma.$queryRaw<
    Array<{ period: string; event_type: string; user_count: number }>
  >`
    SELECT
      DATE_FORMAT(created_at, ${dateFormat}) AS period,
      event_type,
      COUNT(DISTINCT user_id) AS user_count
    FROM event_logs
    WHERE organization_id = ${orgId}
      AND created_at >= ${start}
      AND created_at <= ${end}
    GROUP BY period, event_type
    ORDER BY period ASC
  `;

  // Aggregate totals and build period breakdown
  let totalViews = 0;
  let totalRegistrations = 0;
  let totalPosts = 0;
  let totalEngagements = 0;

  const periodMap = new Map<string, FunnelMetricsPeriod>();

  for (const row of rawResults) {
    const periodKey = row.period;
    if (!periodMap.has(periodKey)) {
      periodMap.set(periodKey, {
        period: periodKey,
        views: 0,
        registrations: 0,
        posts: 0,
        engagements: 0,
      });
    }

    const periodData = periodMap.get(periodKey)!;
    const count = Number(row.user_count);

    switch (row.event_type) {
      case 'page_view':
        periodData.views += count;
        totalViews += count;
        break;
      case 'registration':
        periodData.registrations += count;
        totalRegistrations += count;
        break;
      case 'post_created':
        periodData.posts += count;
        totalPosts += count;
        break;
      case 'engagement':
        periodData.engagements += count;
        totalEngagements += count;
        break;
      default:
        // Include other event types in engagements
        periodData.engagements += count;
        totalEngagements += count;
        break;
    }
  }

  const periods = Array.from(periodMap.values());

  logger.info(
    { orgId, startDate: start.toISOString(), endDate: end.toISOString(), granularity: gran, periodCount: periods.length },
    'Funnel metrics retrieved',
  );

  return {
    metrics: {
      views: totalViews,
      registrations: totalRegistrations,
      posts: totalPosts,
      engagements: totalEngagements,
      periods,
    },
  };
}
