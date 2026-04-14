import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { authMiddleware } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { orgScopeMiddleware } from '../../middleware/orgScope';
import { writeRateLimiter, readRateLimiter } from '../../middleware/rateLimiter';
import { bulkActionSchema, recycleBinQuerySchema } from './moderation.schema';
import * as moderationService from './moderation.service';

const router = Router({ mergeParams: true });

router.post(
  '/moderation/bulk-action',
  authMiddleware, orgScopeMiddleware, requireRole('admin', 'moderator'), writeRateLimiter,
  validate({ body: bulkActionSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await moderationService.bulkAction(req.params.orgId, req.user!.id, req.body);
      res.status(200).json(result);
    } catch (err) { next(err); }
  },
);

router.get(
  '/recycle-bin',
  authMiddleware, orgScopeMiddleware, requireRole('admin', 'moderator'), readRateLimiter,
  validate({ query: recycleBinQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await moderationService.listRecycleBin(req.params.orgId, req.query, req.query);
      res.status(200).json(result);
    } catch (err) { next(err); }
  },
);

router.post(
  '/recycle-bin/:itemType/:itemId/restore',
  authMiddleware, orgScopeMiddleware, requireRole('admin', 'moderator'), writeRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await moderationService.restoreItem(
        req.params.orgId, req.params.itemType, req.params.itemId, req.user!.id,
      );
      res.status(200).json({ item });
    } catch (err) { next(err); }
  },
);

router.delete(
  '/recycle-bin/:itemType/:itemId',
  authMiddleware, orgScopeMiddleware, requireRole('admin'), writeRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await moderationService.permanentDelete(req.params.orgId, req.params.itemType, req.params.itemId, req.user!.id);
      res.status(204).send();
    } catch (err) { next(err); }
  },
);

export default router;
