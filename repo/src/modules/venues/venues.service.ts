import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { NotFoundError, ConflictError, ForbiddenError, BusinessRuleError } from '../../utils/errors';
import { createAuditLog } from '../audit/audit.service';

interface CreateVenueData {
  name: string;
  description?: string;
  capacity?: number;
  isActive?: boolean;
}

interface UpdateVenueData {
  name?: string;
  description?: string;
  capacity?: number;
  isActive?: boolean;
}

interface CreateBookingData {
  title: string;
  startTime: string | Date;
  endTime: string | Date;
}

interface UpdateBookingData {
  title?: string;
  startTime?: string | Date;
  endTime?: string | Date;
  status?: string;
}

interface BookingFilters {
  startDate?: string;
  endDate?: string;
  status?: string;
}

export async function createVenue(
  orgId: string,
  actorId: string,
  data: CreateVenueData,
) {
  const venue = await prisma.venue.create({
    data: {
      organizationId: orgId,
      name: data.name,
      description: data.description ?? null,
      capacity: data.capacity ?? null,
      isActive: data.isActive ?? true,
    },
  });

  await createAuditLog({
    organizationId: orgId,
    actorId,
    action: 'venue_created',
    resourceType: 'venue',
    resourceId: venue.id,
    details: { name: data.name },
  });

  logger.info({ venueId: venue.id, orgId }, 'Venue created');

  return venue;
}

export async function listVenues(orgId: string) {
  const venues = await prisma.venue.findMany({
    where: { organizationId: orgId },
    orderBy: { name: 'asc' },
  });

  return venues;
}

export async function getVenue(orgId: string, venueId: string) {
  const venue = await prisma.venue.findFirst({
    where: { id: venueId, organizationId: orgId },
  });

  if (!venue) {
    throw new NotFoundError('Venue not found');
  }

  return venue;
}

export async function updateVenue(
  orgId: string,
  venueId: string,
  data: UpdateVenueData,
  actorId: string,
) {
  const existing = await prisma.venue.findFirst({
    where: { id: venueId, organizationId: orgId },
  });

  if (!existing) {
    throw new NotFoundError('Venue not found');
  }

  const updated = await prisma.venue.update({
    where: { id: venueId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.capacity !== undefined && { capacity: data.capacity }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  await createAuditLog({
    organizationId: orgId,
    actorId,
    action: 'venue_updated',
    resourceType: 'venue',
    resourceId: venueId,
    details: { changes: data },
  });

  logger.info({ venueId, orgId, actorId }, 'Venue updated');

  return updated;
}

export async function deleteVenue(orgId: string, venueId: string, actorId: string) {
  const existing = await prisma.venue.findFirst({
    where: { id: venueId, organizationId: orgId },
  });

  if (!existing) {
    throw new NotFoundError('Venue not found');
  }

  await prisma.venue.delete({
    where: { id: venueId },
  });

  await createAuditLog({
    organizationId: orgId,
    actorId,
    action: 'config_delete',
    resourceType: 'venue',
    resourceId: venueId,
    details: { name: existing.name },
  });

  logger.info({ venueId, orgId, actorId }, 'Venue deleted');
}

export async function createBooking(
  orgId: string,
  venueId: string,
  userId: string,
  data: CreateBookingData,
) {
  const venue = await prisma.venue.findFirst({
    where: { id: venueId, organizationId: orgId },
  });

  if (!venue) {
    throw new NotFoundError('Venue not found');
  }

  if (!venue.isActive) {
    throw new ConflictError('Venue is not active');
  }

  const startTime = new Date(data.startTime);
  const endTime = new Date(data.endTime);

  const booking = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Check for overlapping confirmed bookings
    const conflicting = await tx.venueBooking.findFirst({
      where: {
        venueId,
        status: 'confirmed',
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });

    if (conflicting) {
      throw new BusinessRuleError(409, 'BOOKING_CONFLICT', 'Time slot overlaps with an existing booking');
    }

    // Create the booking
    const newBooking = await tx.venueBooking.create({
      data: {
        organizationId: orgId,
        venueId,
        bookedBy: userId,
        title: data.title,
        startTime,
        endTime,
        status: 'confirmed',
      },
    });

    return newBooking;
  });

  await createAuditLog({
    organizationId: orgId,
    actorId: userId,
    action: 'booking_created',
    resourceType: 'venue_booking',
    resourceId: booking.id,
    details: { venueId, title: data.title, startTime: startTime.toISOString(), endTime: endTime.toISOString() },
  });

  // Create engagement event log
  await prisma.eventLog.create({
    data: {
      organizationId: orgId,
      userId,
      eventType: 'engagement',
      metadata: { action: 'booking_created', venueId, bookingId: booking.id },
    },
  });

  logger.info({ bookingId: booking.id, venueId, orgId }, 'Booking created');

  return booking;
}

export async function listBookings(
  orgId: string,
  venueId: string,
  filters: BookingFilters,
) {
  const where: Record<string, unknown> = {
    organizationId: orgId,
    venueId,
  };

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.startDate || filters.endDate) {
    const startTime: Record<string, Date> = {};
    if (filters.startDate) {
      startTime.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      startTime.lte = new Date(filters.endDate);
    }
    where.startTime = startTime;
  }

  const bookings = await prisma.venueBooking.findMany({
    where,
    orderBy: { startTime: 'asc' },
  });

  return bookings;
}

export async function updateBooking(
  orgId: string,
  bookingId: string,
  userId: string,
  userRole: string,
  data: UpdateBookingData,
) {
  const booking = await prisma.venueBooking.findFirst({
    where: { id: bookingId, organizationId: orgId },
  });

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  // Verify ownership: must be the booker or an admin
  if (booking.bookedBy !== userId && userRole !== 'admin') {
    throw new ForbiddenError('You do not have permission to update this booking');
  }

  const updateData: Record<string, unknown> = {};

  if (data.title !== undefined) {
    updateData.title = data.title;
  }

  const newStartTime = data.startTime ? new Date(data.startTime) : undefined;
  const newEndTime = data.endTime ? new Date(data.endTime) : undefined;

  if (data.status !== undefined) {
    updateData.status = data.status;
  }

  // If changing times, run conflict check + update inside a transaction
  if (newStartTime || newEndTime) {
    const checkStart = newStartTime ?? booking.startTime;
    const checkEnd = newEndTime ?? booking.endTime;
    if (newStartTime) updateData.startTime = newStartTime;
    if (newEndTime) updateData.endTime = newEndTime;

    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const conflicting = await tx.venueBooking.findFirst({
        where: {
          venueId: booking.venueId,
          status: 'confirmed',
          id: { not: bookingId },
          startTime: { lt: checkEnd },
          endTime: { gt: checkStart },
        },
      });

      if (conflicting) {
        throw new BusinessRuleError(409, 'BOOKING_CONFLICT', 'Time slot overlaps with an existing booking');
      }

      return tx.venueBooking.update({
        where: { id: bookingId },
        data: updateData,
      });
    });

    logger.info({ bookingId, orgId, userId }, 'Booking updated');
    return updated;
  }

  const updated = await prisma.venueBooking.update({
    where: { id: bookingId },
    data: updateData,
  });

  logger.info({ bookingId, orgId, userId }, 'Booking updated');

  return updated;
}

export async function cancelBooking(
  orgId: string,
  bookingId: string,
  userId: string,
  userRole: string,
) {
  const booking = await prisma.venueBooking.findFirst({
    where: { id: bookingId, organizationId: orgId },
  });

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  // Verify ownership: must be the booker or an admin
  if (booking.bookedBy !== userId && userRole !== 'admin') {
    throw new ForbiddenError('You do not have permission to cancel this booking');
  }

  const updated = await prisma.venueBooking.update({
    where: { id: bookingId },
    data: { status: 'cancelled' },
  });

  await createAuditLog({
    organizationId: orgId,
    actorId: userId,
    action: 'booking_cancelled',
    resourceType: 'venue_booking',
    resourceId: bookingId,
    details: { venueId: booking.venueId, title: booking.title },
  });

  logger.info({ bookingId, orgId, userId }, 'Booking cancelled');

  return updated;
}
