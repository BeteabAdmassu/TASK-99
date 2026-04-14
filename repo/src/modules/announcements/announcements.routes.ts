import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { authMiddleware } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { orgScopeMiddleware } from '../../middleware/orgScope';
import { writeRateLimiter, readRateLimiter } from '../../middleware/rateLimiter';
import { createAnnouncementSchema, updateAnnouncementSchema, listAnnouncementsQuerySchema } from './announcements.schema';
import * as announcementsService from './announcements.service';

const router = Router({ mergeParams: true });

router.post(
  '/',
  authMiddleware, orgScopeMiddleware, requireRole('admin'), writeRateLimiter,
  validate({ body: createAnnouncementSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const announcement = await announcementsService.createAnnouncement(req.params.orgId, req.user!.id, req.body);
      res.status(201).json({ announcement });
    } catch (err) { next(err); }
  },
);

router.get(
  '/',
  authMiddleware, orgScopeMiddleware, readRateLimiter,
  validate({ query: listAnnouncementsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const includeExpired = req.query.includeExpired === 'true';
      const result = await announcementsService.listAnnouncements(req.params.orgId, includeExpired, req.query);
      res.status(200).json(result);
    } catch (err) { next(err); }
  },
);

router.get(
  '/:id',
  authMiddleware, orgScopeMiddleware, readRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const announcement = await announcementsService.getAnnouncement(req.params.orgId, req.params.id);
      res.status(200).json({ announcement });
    } catch (err) { next(err); }
  },
);

router.put(
  '/:id',
  authMiddleware, orgScopeMiddleware, requireRole('admin'), writeRateLimiter,
  validate({ body: updateAnnouncementSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const announcement = await announcementsService.updateAnnouncement(
        req.params.orgId, req.params.id, req.body, req.user!.id,
      );
      res.status(200).json({ announcement });
    } catch (err) { next(err); }
  },
);

router.delete(
  '/:id',
  authMiddleware, orgScopeMiddleware, requireRole('admin'), writeRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await announcementsService.deleteAnnouncement(req.params.orgId, req.params.id, req.user!.id);
      res.status(204).send();
    } catch (err) { next(err); }
  },
);

export default router;
