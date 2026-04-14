import { z } from 'zod';

export const createVenueSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  description: z.string().max(5000).optional(),
  capacity: z.number().int().min(1).optional(),
});

export const updateVenueSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  description: z.string().max(5000).optional(),
  capacity: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const createBookingSchema = z.object({
  title: z.string().min(1).max(255).trim(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
}).refine((data) => new Date(data.endTime) > new Date(data.startTime), {
  message: 'End time must be after start time',
  path: ['endTime'],
});

export const updateBookingSchema = z.object({
  title: z.string().min(1).max(255).trim().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
}).refine((data) => {
  if (data.startTime && data.endTime) {
    return new Date(data.endTime) > new Date(data.startTime);
  }
  return true;
}, {
  message: 'End time must be after start time',
  path: ['endTime'],
});

export const listBookingsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(['confirmed', 'cancelled']).optional(),
});
