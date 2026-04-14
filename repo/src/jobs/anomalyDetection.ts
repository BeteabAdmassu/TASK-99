import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { runDetection } from '../modules/anomalies/anomalies.service';

export async function anomalyDetectionJob(): Promise<void> {
  const orgs = await prisma.organization.findMany({ select: { id: true } });

  for (const org of orgs) {
    try {
      await runDetection(org.id);
    } catch (err) {
      logger.error({ err, organizationId: org.id }, 'Anomaly detection failed for organization');
    }
  }
}
