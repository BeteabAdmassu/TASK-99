import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { authMiddleware } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { orgScopeMiddleware } from '../../middleware/orgScope';
import { readRateLimiter } from '../../middleware/rateLimiter';
import { funnelQuerySchema } from './analytics.schema';
import * as analyticsService from './analytics.service';

const router = Router({ mergeParams: true });

router.get(
  '/funnel',
  authMiddleware, orgScopeMiddleware, requireRole('admin', 'analyst'), readRateLimiter,
  validate({ query: funnelQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const metrics = await analyticsService.getFunnelMetrics(
        req.params.orgId,
        req.query.startDate as string | undefined,
        req.query.endDate as string | undefined,
        (req.query.granularity as string) || 'day',
      );
      res.status(200).json({ metrics });
    } catch (err) { next(err); }
  },
);

export default router;
