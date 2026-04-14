import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { authMiddleware } from '../../middleware/auth';
import { orgScopeMiddleware } from '../../middleware/orgScope';
import { writeRateLimiter, readRateLimiter } from '../../middleware/rateLimiter';
import { listNotificationsQuerySchema } from './notifications.schema';
import * as notificationsService from './notifications.service';

const router = Router({ mergeParams: true });

router.get(
  '/',
  authMiddleware, orgScopeMiddleware, readRateLimiter,
  validate({ query: listNotificationsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await notificationsService.listNotifications(
        req.params.orgId, req.user!.id, req.query, req.query,
      );
      res.status(200).json(result);
    } catch (err) { next(err); }
  },
);

// read-all MUST come before /:id/read to avoid "read-all" matching as :id
router.put(
  '/read-all',
  authMiddleware, orgScopeMiddleware, writeRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updatedCount = await notificationsService.markAllRead(req.params.orgId, req.user!.id);
      res.status(200).json({ updatedCount });
    } catch (err) { next(err); }
  },
);

router.put(
  '/:id/read',
  authMiddleware, orgScopeMiddleware, writeRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notification = await notificationsService.markRead(req.params.orgId, req.params.id, req.user!.id);
      res.status(200).json({ notification });
    } catch (err) { next(err); }
  },
);

export default router;
