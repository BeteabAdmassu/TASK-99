import { z } from 'zod';

export const listAuditLogsQuerySchema = z.object({
  action: z.string().optional(),
  actorId: z.string().uuid().optional(),
  resourceType: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});
