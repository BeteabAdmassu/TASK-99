import { z } from 'zod';

export const createFlagSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.]+$/, 'Key must be alphanumeric with underscores and dots'),
  value: z.record(z.any()),
  description: z.string().max(500).optional(),
});

export const updateFlagSchema = z.object({
  value: z.record(z.any()).optional(),
  description: z.string().max(500).optional(),
});
