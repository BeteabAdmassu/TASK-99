import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { authMiddleware } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { orgScopeMiddleware } from '../../middleware/orgScope';
import { readRateLimiter } from '../../middleware/rateLimiter';
import { listAuditLogsQuerySchema } from './audit.schema';
import * as auditService from './audit.service';

const router = Router({ mergeParams: true });

router.get(
  '/',
  authMiddleware, orgScopeMiddleware, requireRole('admin', 'analyst'), readRateLimiter,
  validate({ query: listAuditLogsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await auditService.listAuditLogs(req.params.orgId, req.query, req.query);
      res.status(200).json(result);
    } catch (err) { next(err); }
  },
);

export default router;
