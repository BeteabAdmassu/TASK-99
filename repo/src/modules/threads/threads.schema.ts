import { z } from 'zod';

export const createThreadSchema = z.object({
  subsectionId: z.string().uuid(),
  title: z.string().min(1).max(300).trim(),
  body: z.string().min(1).max(50000),
  tagIds: z.array(z.string().uuid()).max(10).optional(),
});

export const updateThreadSchema = z.object({
  title: z.string().min(1).max(300).trim().optional(),
  body: z.string().min(1).max(50000).optional(),
  tagIds: z.array(z.string().uuid()).max(10).optional(),
});

export const listThreadsQuerySchema = z.object({
  subsectionId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.enum(['latest', 'oldest', 'mostReplies', 'mostViews']).optional(),
});

export const updateThreadStateSchema = z.object({
  isPinned: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isLocked: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

export type CreateThreadInput = z.infer<typeof createThreadSchema>;
export type UpdateThreadInput = z.infer<typeof updateThreadSchema>;
export type UpdateThreadStateInput = z.infer<typeof updateThreadStateSchema>;
