import { z } from 'zod';

export const bulkActionSchema = z.object({
  action: z.enum(['delete', 'lock', 'archive', 'move']),
  resourceType: z.enum(['thread', 'reply']),
  resourceIds: z.array(z.string().uuid()).min(1).max(100),
});

export const recycleBinQuerySchema = z.object({
  resourceType: z.enum(['thread', 'reply']).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

export type BulkActionInput = z.infer<typeof bulkActionSchema>;
