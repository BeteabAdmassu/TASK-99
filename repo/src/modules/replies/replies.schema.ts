import { z } from 'zod';

export const createReplySchema = z.object({
  body: z.string().min(1).max(50000),
  parentReplyId: z.string().uuid().optional(),
});

export const updateReplySchema = z.object({
  body: z.string().min(1).max(50000),
});

export const listRepliesQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
});
