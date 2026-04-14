import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
  status: z.enum(['pending', 'delivered', 'read', 'failed']).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});
