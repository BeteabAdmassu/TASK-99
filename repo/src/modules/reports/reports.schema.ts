import { z } from 'zod';

export const createReportSchema = z.object({
  reason: z.string().min(1).max(2000),
});

export const listReportsQuerySchema = z.object({
  status: z.enum(['pending', 'reviewed', 'dismissed']).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

export const updateReportSchema = z.object({
  status: z.enum(['reviewed', 'dismissed']),
});
