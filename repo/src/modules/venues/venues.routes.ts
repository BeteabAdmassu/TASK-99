import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { authMiddleware } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { orgScopeMiddleware } from '../../middleware/orgScope';
import { checkBanMuteMiddleware } from '../../middleware/checkBanMute';
import { writeRateLimiter, readRateLimiter } from '../../middleware/rateLimiter';
import { createVenueSchema, updateVenueSchema, createBookingSchema, updateBookingSchema, listBookingsQuerySchema } from './venues.schema';
import * as venuesService from './venues.service';

const router = Router({ mergeParams: true });

// Venues
router.post(
  '/venues',
  authMiddleware, orgScopeMiddleware, requireRole('admin'), writeRateLimiter,
  validate({ body: createVenueSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const venue = await venuesService.createVenue(req.params.orgId, req.user!.id, req.body);
      res.status(201).json({ venue });
    } catch (err) { next(err); }
  },
);

router.get(
  '/venues',
  authMiddleware, orgScopeMiddleware, readRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const venues = await venuesService.listVenues(req.params.orgId);
      res.status(200).json({ data: venues });
    } catch (err) { next(err); }
  },
);

router.get(
  '/venues/:venueId',
  authMiddleware, orgScopeMiddleware, readRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const venue = await venuesService.getVenue(req.params.orgId, req.params.venueId);
      res.status(200).json({ venue });
    } catch (err) { next(err); }
  },
);

router.put(
  '/venues/:venueId',
  authMiddleware, orgScopeMiddleware, requireRole('admin'), writeRateLimiter,
  validate({ body: updateVenueSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const venue = await venuesService.updateVenue(req.params.orgId, req.params.venueId, req.body, req.user!.id);
      res.status(200).json({ venue });
    } catch (err) { next(err); }
  },
);

router.delete(
  '/venues/:venueId',
  authMiddleware, orgScopeMiddleware, requireRole('admin'), writeRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await venuesService.deleteVenue(req.params.orgId, req.params.venueId);
      res.status(204).send();
    } catch (err) { next(err); }
  },
);

// Bookings
router.post(
  '/venues/:venueId/bookings',
  authMiddleware, orgScopeMiddleware, checkBanMuteMiddleware, writeRateLimiter,
  validate({ body: createBookingSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const booking = await venuesService.createBooking(
        req.params.orgId, req.params.venueId, req.user!.id, req.body,
      );
      res.status(201).json({ booking });
    } catch (err) { next(err); }
  },
);

router.get(
  '/venues/:venueId/bookings',
  authMiddleware, orgScopeMiddleware, readRateLimiter,
  validate({ query: listBookingsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bookings = await venuesService.listBookings(req.params.orgId, req.params.venueId, req.query);
      res.status(200).json({ data: bookings });
    } catch (err) { next(err); }
  },
);

router.put(
  '/bookings/:bookingId',
  authMiddleware, orgScopeMiddleware, checkBanMuteMiddleware, writeRateLimiter,
  validate({ body: updateBookingSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const booking = await venuesService.updateBooking(
        req.params.orgId, req.params.bookingId, req.user!.id, req.user!.role, req.body,
      );
      res.status(200).json({ booking });
    } catch (err) { next(err); }
  },
);

router.delete(
  '/bookings/:bookingId',
  authMiddleware, orgScopeMiddleware, checkBanMuteMiddleware, writeRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await venuesService.cancelBooking(req.params.orgId, req.params.bookingId, req.user!.id, req.user!.role);
      res.status(204).send();
    } catch (err) { next(err); }
  },
);

export default router;
