import { z } from 'zod';

export const createCarouselSchema = z.object({
  title: z.string().min(1).max(300).trim(),
  imageUrl: z.string().max(1000).url().optional(),
  linkUrl: z.string().max(1000).url().optional(),
  displayOrder: z.number().int().min(0).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
}).refine((data) => new Date(data.endDate) > new Date(data.startDate), {
  message: 'End date must be after start date',
  path: ['endDate'],
});

export const updateCarouselSchema = z.object({
  title: z.string().min(1).max(300).trim().optional(),
  imageUrl: z.string().max(1000).url().optional(),
  linkUrl: z.string().max(1000).url().optional(),
  displayOrder: z.number().int().min(0).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

export const listCarouselQuerySchema = z.object({
  includeExpired: z.string().optional(),
});
