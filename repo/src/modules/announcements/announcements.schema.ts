import { z } from 'zod';

export const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(300).trim(),
  body: z.string().min(1).max(50000),
  displayOrder: z.number().int().min(0).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
}).refine((data) => new Date(data.endDate) > new Date(data.startDate), {
  message: 'End date must be after start date',
  path: ['endDate'],
});

export const updateAnnouncementSchema = z.object({
  title: z.string().min(1).max(300).trim().optional(),
  body: z.string().min(1).max(50000).optional(),
  displayOrder: z.number().int().min(0).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isPublished: z.boolean().optional(),
});

export const listAnnouncementsQuerySchema = z.object({
  includeExpired: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});
