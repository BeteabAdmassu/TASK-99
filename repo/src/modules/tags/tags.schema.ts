import { z } from 'zod';

export const createTagSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  slug: z.string().min(1).max(100).trim().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  category: z.string().max(100).optional(),
});

export const updateTagSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  slug: z.string().min(1).max(100).trim().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
  category: z.string().max(100).optional(),
});

export const listTagsQuerySchema = z.object({
  category: z.string().optional(),
});
