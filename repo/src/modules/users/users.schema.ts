import { z } from 'zod';

export const createUserSchema = z.object({
  username: z.string().min(3).max(100).trim().regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric with underscores'),
  password: z.string().min(12).max(128),
  role: z.enum(['admin', 'moderator', 'analyst', 'user']).optional(),
  email: z.string().email().max(255).optional(),
});

export const listUsersQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  role: z.enum(['admin', 'moderator', 'analyst', 'user']).optional(),
  search: z.string().max(200).optional(),
});

export const updateRoleSchema = z.object({
  role: z.enum(['admin', 'moderator', 'analyst', 'user']),
});

export const banUserSchema = z.object({
  reason: z.string().max(2000).optional(),
});

export const muteUserSchema = z.object({
  durationHours: z.number().int().min(24).max(720),
  reason: z.string().max(2000).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type MuteUserInput = z.infer<typeof muteUserSchema>;
