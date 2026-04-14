import { z } from 'zod';

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  slug: z.string().min(1).max(255).trim().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  settings: z.record(z.any()).optional(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  settings: z.record(z.any()).optional(),
});

export const orgIdParamSchema = z.object({
  orgId: z.string().uuid(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
