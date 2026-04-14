import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(3).max(100).trim(),
  password: z.string().min(12).max(128),
  organizationId: z.string().uuid(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12).max(128),
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: 'New password must differ from current password',
  path: ['newPassword'],
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
