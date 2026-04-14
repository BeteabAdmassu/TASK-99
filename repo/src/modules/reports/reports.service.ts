import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { parsePagination, buildPaginatedResponse } from '../../utils/pagination';
import { createAuditLog } from '../audit/audit.service';

interface ReportFilters {
  status?: 'pending' | 'reviewed' | 'dismissed';
}

interface PaginationInput {
  page?: string | number;
  limit?: string | number;
}

export async function createReport(
  orgId: string,
  threadId: string,
  userId: string,
  reason: string,
) {
  const thread = await prisma.thread.findFirst({
    where: { id: threadId, organizationId: orgId, deletedAt: null },
  });

  if (!thread) {
    throw new NotFoundError('Thread not found');
  }

  const report = await prisma.threadReport.create({
    data: {
      organizationId: orgId,
      threadId,
      reportedBy: userId,
      reason,
      status: 'pending',
    },
    include: {
      thread: { select: { id: true, title: true } },
      reporter: { select: { id: true, username: true } },
    },
  });

  return report;
}

export async function listReports(
  orgId: string,
  filters: ReportFilters,
  pagination: PaginationInput,
) {
  const { skip, take, page, limit } = parsePagination(pagination);

  const where: Record<string, unknown> = {
    organizationId: orgId,
  };

  if (filters.status) {
    where.status = filters.status;
  }

  const [data, total] = await Promise.all([
    prisma.threadReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        thread: { select: { id: true, title: true } },
        reporter: { select: { id: true, username: true } },
      },
    }),
    prisma.threadReport.count({ where }),
  ]);

  return buildPaginatedResponse(data, total, page, limit);
}

export async function updateReportStatus(
  orgId: string,
  reportId: string,
  status: 'reviewed' | 'dismissed',
  actorId: string,
) {
  const report = await prisma.threadReport.findFirst({
    where: { id: reportId, organizationId: orgId },
  });

  if (!report) {
    throw new NotFoundError('Report not found');
  }

  const updated = await prisma.threadReport.update({
    where: { id: reportId },
    data: { status },
    include: {
      thread: { select: { id: true, title: true } },
      reporter: { select: { id: true, username: true } },
    },
  });

  await createAuditLog({
    organizationId: orgId,
    actorId,
    action: 'report_status_update',
    resourceType: 'thread_report',
    resourceId: reportId,
    details: { previousStatus: report.status, newStatus: status },
  });

  return updated;
}
