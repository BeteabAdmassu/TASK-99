import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { NotFoundError } from '../../utils/errors';
import { parsePagination, buildPaginatedResponse } from '../../utils/pagination';
import { createAuditLog } from '../audit/audit.service';

interface AnomalyFilters {
  status?: string;
  severity?: string;
}

interface PaginationInput {
  page?: string | number;
  limit?: string | number;
}

export async function runDetection(orgId?: string) {
  const createdAnomalies: Array<{ id: string; ruleName: string; severity: string }> = [];

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  // Build the organization filter
  const orgFilter = orgId ? { organizationId: orgId } : {};

  // Rule 1: Excessive deletions
  // audit_logs WHERE action IN ('thread_deleted','reply_deleted') AND createdAt > 1hr ago
  // GROUP BY actorId HAVING COUNT >= 10
  const deletionCounts = await prisma.auditLog.groupBy({
    by: ['actorId', 'organizationId'],
    where: {
      ...orgFilter,
      action: { in: ['thread_deleted', 'reply_deleted'] },
      createdAt: { gte: oneHourAgo },
      actorId: { not: null },
    },
    _count: { id: true },
    having: {
      id: { _count: { gte: 10 } },
    },
  });

  for (const row of deletionCounts) {
    if (!row.actorId) continue;

    // Skip if open anomaly already exists for same user+rule
    const existingAnomaly = await prisma.anomalyFlag.findFirst({
      where: {
        flaggedUserId: row.actorId,
        ruleName: 'excessive_deletions',
        status: 'open',
      },
    });

    if (existingAnomaly) continue;

    const anomaly = await prisma.anomalyFlag.create({
      data: {
        organizationId: row.organizationId,
        flaggedUserId: row.actorId,
        ruleName: 'excessive_deletions',
        description: `User performed ${row._count.id} deletions in the last hour`,
        severity: 'high',
        status: 'open',
      },
    });

    createdAnomalies.push({ id: anomaly.id, ruleName: anomaly.ruleName, severity: anomaly.severity });

    logger.warn(
      { alert: true, anomalyId: anomaly.id, ruleName: 'excessive_deletions', userId: row.actorId, count: row._count.id },
      'Anomaly detected: excessive deletions',
    );
  }

  // Rule 2: Excessive undos
  // audit_logs WHERE action IN ('booking_cancelled','thread_deleted','reply_deleted','content_restored')
  // AND createdAt > 1hr ago, GROUP BY actorId HAVING COUNT >= 20
  const undoCounts = await prisma.auditLog.groupBy({
    by: ['actorId', 'organizationId'],
    where: {
      ...orgFilter,
      action: { in: ['booking_cancelled', 'thread_deleted', 'reply_deleted', 'content_restored'] },
      createdAt: { gte: oneHourAgo },
      actorId: { not: null },
    },
    _count: { id: true },
    having: {
      id: { _count: { gte: 20 } },
    },
  });

  for (const row of undoCounts) {
    if (!row.actorId) continue;

    const existingAnomaly = await prisma.anomalyFlag.findFirst({
      where: {
        flaggedUserId: row.actorId,
        ruleName: 'excessive_undos',
        status: 'open',
      },
    });

    if (existingAnomaly) continue;

    const anomaly = await prisma.anomalyFlag.create({
      data: {
        organizationId: row.organizationId,
        flaggedUserId: row.actorId,
        ruleName: 'excessive_undos',
        description: `User performed ${row._count.id} undo-type actions in the last hour`,
        severity: 'medium',
        status: 'open',
      },
    });

    createdAnomalies.push({ id: anomaly.id, ruleName: anomaly.ruleName, severity: anomaly.severity });

    logger.warn(
      { alert: true, anomalyId: anomaly.id, ruleName: 'excessive_undos', userId: row.actorId, count: row._count.id },
      'Anomaly detected: excessive undos',
    );
  }

  // Rule 3: Reported content
  // thread_reports WHERE createdAt > 30min ago AND status='pending'
  // GROUP BY threadId HAVING COUNT >= 5
  const reportCounts = await prisma.threadReport.groupBy({
    by: ['threadId', 'organizationId'],
    where: {
      ...orgFilter,
      status: 'pending',
      createdAt: { gte: thirtyMinutesAgo },
    },
    _count: { id: true },
    having: {
      id: { _count: { gte: 5 } },
    },
  });

  for (const row of reportCounts) {
    const existingAnomaly = await prisma.anomalyFlag.findFirst({
      where: {
        flaggedThreadId: row.threadId,
        ruleName: 'reported_content',
        status: 'open',
      },
    });

    if (existingAnomaly) continue;

    const anomaly = await prisma.anomalyFlag.create({
      data: {
        organizationId: row.organizationId,
        flaggedThreadId: row.threadId,
        ruleName: 'reported_content',
        description: `Thread received ${row._count.id} reports in the last 30 minutes`,
        severity: 'high',
        status: 'open',
      },
    });

    createdAnomalies.push({ id: anomaly.id, ruleName: anomaly.ruleName, severity: anomaly.severity });

    logger.warn(
      { alert: true, anomalyId: anomaly.id, ruleName: 'reported_content', threadId: row.threadId, count: row._count.id },
      'Anomaly detected: reported content',
    );
  }

  logger.info({ anomaliesCreated: createdAnomalies.length }, 'Anomaly detection run completed');

  return createdAnomalies;
}

export async function listAnomalies(
  orgId: string,
  filters: AnomalyFilters,
  pagination: PaginationInput,
) {
  const { skip, take, page, limit } = parsePagination(pagination);

  const where: Record<string, unknown> = {
    organizationId: orgId,
  };

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.severity) {
    where.severity = filters.severity;
  }

  const [data, total] = await Promise.all([
    prisma.anomalyFlag.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        flaggedUser: {
          select: { id: true, username: true, role: true },
        },
        flaggedThread: {
          select: { id: true, title: true },
        },
      },
    }),
    prisma.anomalyFlag.count({ where }),
  ]);

  return buildPaginatedResponse(data, total, page, limit);
}

export async function updateAnomalyStatus(
  orgId: string,
  anomalyId: string,
  status: string,
  actorId: string,
) {
  const existing = await prisma.anomalyFlag.findFirst({
    where: { id: anomalyId, organizationId: orgId },
  });

  if (!existing) {
    throw new NotFoundError('Anomaly not found');
  }

  const updateData: Record<string, unknown> = {
    status,
  };

  if (status === 'resolved') {
    updateData.resolvedAt = new Date();
    updateData.resolvedBy = actorId;
  }

  const updated = await prisma.anomalyFlag.update({
    where: { id: anomalyId },
    data: updateData,
  });

  await createAuditLog({
    organizationId: orgId,
    actorId,
    action: 'anomaly_status_updated',
    resourceType: 'anomaly_flag',
    resourceId: anomalyId,
    details: { previousStatus: existing.status, newStatus: status },
  });

  logger.info({ anomalyId, orgId, status, actorId }, 'Anomaly status updated');

  return updated;
}
