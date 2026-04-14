import { z } from 'zod';

export const createSectionSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  description: z.string().max(5000).optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export const updateSectionSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  description: z.string().max(5000).optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export const listSectionsQuerySchema = z.object({
  includeSubsections: z.string().optional(),
});

export const createSubsectionSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  description: z.string().max(5000).optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export const updateSubsectionSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  description: z.string().max(5000).optional(),
  displayOrder: z.number().int().min(0).optional(),
});
