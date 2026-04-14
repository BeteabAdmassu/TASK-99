import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { authMiddleware } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { orgScopeMiddleware } from '../../middleware/orgScope';
import { writeRateLimiter, readRateLimiter } from '../../middleware/rateLimiter';
import { createFlagSchema, updateFlagSchema } from './feature-flags.schema';
import * as featureFlagsService from './feature-flags.service';

const router = Router({ mergeParams: true });

router.post(
  '/',
  authMiddleware, orgScopeMiddleware, requireRole('admin'), writeRateLimiter,
  validate({ body: createFlagSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const flag = await featureFlagsService.createFlag(req.params.orgId, req.user!.id, req.body);
      res.status(201).json({ flag });
    } catch (err) { next(err); }
  },
);

router.get(
  '/',
  authMiddleware, orgScopeMiddleware, requireRole('admin'), readRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const flags = await featureFlagsService.listFlags(req.params.orgId);
      res.status(200).json({ data: flags });
    } catch (err) { next(err); }
  },
);

router.put(
  '/:flagId',
  authMiddleware, orgScopeMiddleware, requireRole('admin'), writeRateLimiter,
  validate({ body: updateFlagSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const flag = await featureFlagsService.updateFlag(
        req.params.orgId, req.params.flagId, req.user!.id, req.body,
      );
      res.status(200).json({ flag });
    } catch (err) { next(err); }
  },
);

router.delete(
  '/:flagId',
  authMiddleware, orgScopeMiddleware, requireRole('admin'), writeRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await featureFlagsService.deleteFlag(req.params.orgId, req.params.flagId, req.user!.id);
      res.status(204).send();
    } catch (err) { next(err); }
  },
);

export default router;
