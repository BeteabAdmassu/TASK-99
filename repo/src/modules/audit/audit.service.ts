import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { parsePagination, buildPaginatedResponse } from '../../utils/pagination';

interface CreateAuditLogData {
  organizationId: string;
  actorId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  correlationId?: string;
}

interface AuditLogFilters {
  action?: string;
  actorId?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
}

interface PaginationInput {
  page?: string | number;
  limit?: string | number;
}

export async function createAuditLog(data: CreateAuditLogData) {
  const record = await prisma.auditLog.create({
    data: {
      organizationId: data.organizationId,
      actorId: data.actorId ?? null,
      action: data.action,
      resourceType: data.resourceType ?? null,
      resourceId: data.resourceId ?? null,
      details: data.details ?? null,
      ipAddress: data.ipAddress ?? null,
      correlationId: data.correlationId ?? null,
    },
  });

  logger.info(
    { auditLogId: record.id, action: record.action, resourceType: record.resourceType },
    'Audit log created',
  );

  return record;
}

export async function listAuditLogs(
  orgId: string,
  filters: AuditLogFilters,
  pagination: PaginationInput,
) {
  const { skip, take, page, limit } = parsePagination(pagination);

  const where: Record<string, unknown> = {
    organizationId: orgId,
  };

  if (filters.action) {
    where.action = filters.action;
  }

  if (filters.actorId) {
    where.actorId = filters.actorId;
  }

  if (filters.resourceType) {
    where.resourceType = filters.resourceType;
  }

  if (filters.startDate || filters.endDate) {
    const createdAt: Record<string, Date> = {};
    if (filters.startDate) {
      createdAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      createdAt.lte = new Date(filters.endDate);
    }
    where.createdAt = createdAt;
  }

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return buildPaginatedResponse(data, total, page, limit);
}
