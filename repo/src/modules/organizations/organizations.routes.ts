import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { authMiddleware } from '../../middleware/auth';
import { requireRole, requirePlatformAdmin } from '../../middleware/rbac';
import { orgScopeMiddleware } from '../../middleware/orgScope';
import { writeRateLimiter } from '../../middleware/rateLimiter';
import { createOrganizationSchema, updateOrganizationSchema } from './organizations.schema';
import * as orgService from './organizations.service';

const router = Router();

router.post(
  '/',
  authMiddleware,
  requirePlatformAdmin,
  writeRateLimiter,
  validate({ body: createOrganizationSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const org = await orgService.createOrganization(req.body);
      res.status(201).json({ organization: org });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/:orgId',
  authMiddleware,
  orgScopeMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const org = await orgService.getOrganization(req.params.orgId);
      res.status(200).json({ organization: org });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  '/:orgId',
  authMiddleware,
  orgScopeMiddleware,
  requireRole('admin'),
  writeRateLimiter,
  validate({ body: updateOrganizationSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const org = await orgService.updateOrganization(req.params.orgId, req.body, req.user!.id);
      res.status(200).json({ organization: org });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
