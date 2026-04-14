import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { authMiddleware } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { orgScopeMiddleware } from '../../middleware/orgScope';
import { writeRateLimiter, readRateLimiter } from '../../middleware/rateLimiter';
import { listAnomaliesQuerySchema, updateAnomalySchema } from './anomalies.schema';
import * as anomaliesService from './anomalies.service';

const router = Router({ mergeParams: true });

router.get(
  '/',
  authMiddleware, orgScopeMiddleware, requireRole('admin', 'moderator', 'analyst'), readRateLimiter,
  validate({ query: listAnomaliesQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await anomaliesService.listAnomalies(req.params.orgId, req.query, req.query);
      res.status(200).json(result);
    } catch (err) { next(err); }
  },
);

router.put(
  '/:id',
  authMiddleware, orgScopeMiddleware, requireRole('admin', 'moderator'), writeRateLimiter,
  validate({ body: updateAnomalySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const anomaly = await anomaliesService.updateAnomalyStatus(
        req.params.orgId, req.params.id, req.body.status, req.user!.id,
      );
      res.status(200).json({ anomaly });
    } catch (err) { next(err); }
  },
);

export default router;
