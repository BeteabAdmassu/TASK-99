import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { authMiddleware } from '../../middleware/auth';
import { requireRole, denyRole } from '../../middleware/rbac';
import { orgScopeMiddleware } from '../../middleware/orgScope';
import { checkBanMuteMiddleware } from '../../middleware/checkBanMute';
import { writeRateLimiter, readRateLimiter } from '../../middleware/rateLimiter';
import { createThreadSchema, updateThreadSchema, listThreadsQuerySchema, updateThreadStateSchema } from './threads.schema';
import * as threadsService from './threads.service';

const router = Router({ mergeParams: true });

router.post(
  '/',
  authMiddleware, orgScopeMiddleware, denyRole('analyst'), checkBanMuteMiddleware, writeRateLimiter,
  validate({ body: createThreadSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const thread = await threadsService.createThread(req.params.orgId, req.user!.id, req.body);
      res.status(201).json({ thread });
    } catch (err) { next(err); }
  },
);

router.get(
  '/',
  authMiddleware, orgScopeMiddleware, readRateLimiter,
  validate({ query: listThreadsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await threadsService.listThreads(req.params.orgId, req.query, req.query);
      res.status(200).json(result);
    } catch (err) { next(err); }
  },
);

router.get(
  '/:threadId',
  authMiddleware, orgScopeMiddleware, readRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const thread = await threadsService.getThread(req.params.orgId, req.params.threadId);
      res.status(200).json({ thread });
    } catch (err) { next(err); }
  },
);

router.put(
  '/:threadId',
  authMiddleware, orgScopeMiddleware, denyRole('analyst'), checkBanMuteMiddleware, writeRateLimiter,
  validate({ body: updateThreadSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const thread = await threadsService.updateThread(
        req.params.orgId, req.params.threadId, req.user!.id, req.user!.role, req.body,
      );
      res.status(200).json({ thread });
    } catch (err) { next(err); }
  },
);

router.delete(
  '/:threadId',
  authMiddleware, orgScopeMiddleware, denyRole('analyst'), checkBanMuteMiddleware, writeRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await threadsService.deleteThread(req.params.orgId, req.params.threadId, req.user!.id, req.user!.role);
      res.status(204).send();
    } catch (err) { next(err); }
  },
);

router.put(
  '/:threadId/state',
  authMiddleware, orgScopeMiddleware, requireRole('admin', 'moderator'), writeRateLimiter,
  validate({ body: updateThreadStateSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const thread = await threadsService.updateThreadState(
        req.params.orgId, req.params.threadId, req.body, req.user!.id,
      );
      res.status(200).json({ thread });
    } catch (err) { next(err); }
  },
);

export default router;
