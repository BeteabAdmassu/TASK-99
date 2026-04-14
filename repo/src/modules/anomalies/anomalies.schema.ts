import { z } from 'zod';

export const listAnomaliesQuerySchema = z.object({
  status: z.enum(['open', 'acknowledged', 'resolved', 'dismissed']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

export const updateAnomalySchema = z.object({
  status: z.enum(['acknowledged', 'resolved', 'dismissed']),
});
