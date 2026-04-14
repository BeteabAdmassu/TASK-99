import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { authMiddleware } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { orgScopeMiddleware } from '../../middleware/orgScope';
import { checkBanMuteMiddleware } from '../../middleware/checkBanMute';
import { writeRateLimiter, readRateLimiter } from '../../middleware/rateLimiter';
import { createReportSchema, listReportsQuerySchema, updateReportSchema } from './reports.schema';
import * as reportsService from './reports.service';

const router = Router({ mergeParams: true });

// POST /api/organizations/:orgId/threads/:threadId/reports
router.post(
  '/threads/:threadId/reports',
  authMiddleware, orgScopeMiddleware, checkBanMuteMiddleware, writeRateLimiter,
  validate({ body: createReportSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await reportsService.createReport(
        req.params.orgId, req.params.threadId, req.user!.id, req.body.reason,
      );
      res.status(201).json({ report });
    } catch (err) { next(err); }
  },
);

// GET /api/organizations/:orgId/reports
router.get(
  '/reports',
  authMiddleware, orgScopeMiddleware, requireRole('admin', 'moderator'), readRateLimiter,
  validate({ query: listReportsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await reportsService.listReports(req.params.orgId, req.query, req.query);
      res.status(200).json(result);
    } catch (err) { next(err); }
  },
);

// PUT /api/organizations/:orgId/reports/:reportId
router.put(
  '/reports/:reportId',
  authMiddleware, orgScopeMiddleware, requireRole('admin', 'moderator'), writeRateLimiter,
  validate({ body: updateReportSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await reportsService.updateReportStatus(
        req.params.orgId, req.params.reportId, req.body.status, req.user!.id,
      );
      res.status(200).json({ report });
    } catch (err) { next(err); }
  },
);

export default router;
