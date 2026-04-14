import { z } from 'zod';

export const funnelQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  granularity: z.enum(['day', 'week', 'month']).optional(),
});
