import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { authMiddleware } from '../../middleware/auth';
import { denyRole } from '../../middleware/rbac';
import { orgScopeMiddleware } from '../../middleware/orgScope';
import { checkBanMuteMiddleware } from '../../middleware/checkBanMute';
import { writeRateLimiter, readRateLimiter } from '../../middleware/rateLimiter';
import { createReplySchema, updateReplySchema, listRepliesQuerySchema } from './replies.schema';
import * as repliesService from './replies.service';

const router = Router({ mergeParams: true });

// POST /api/organizations/:orgId/threads/:threadId/replies
router.post(
  '/threads/:threadId/replies',
  authMiddleware, orgScopeMiddleware, denyRole('analyst'), checkBanMuteMiddleware, writeRateLimiter,
  validate({ body: createReplySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reply = await repliesService.createReply(
        req.params.orgId, req.params.threadId, req.user!.id, req.body,
      );
      res.status(201).json({ reply });
    } catch (err) { next(err); }
  },
);

// GET /api/organizations/:orgId/threads/:threadId/replies
router.get(
  '/threads/:threadId/replies',
  authMiddleware, orgScopeMiddleware, readRateLimiter,
  validate({ query: listRepliesQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await repliesService.listReplies(req.params.orgId, req.params.threadId, req.query);
      res.status(200).json(result);
    } catch (err) { next(err); }
  },
);

// PUT /api/organizations/:orgId/replies/:replyId
router.put(
  '/replies/:replyId',
  authMiddleware, orgScopeMiddleware, denyRole('analyst'), checkBanMuteMiddleware, writeRateLimiter,
  validate({ body: updateReplySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reply = await repliesService.updateReply(
        req.params.orgId, req.params.replyId, req.user!.id, req.user!.role, req.body,
      );
      res.status(200).json({ reply });
    } catch (err) { next(err); }
  },
);

// DELETE /api/organizations/:orgId/replies/:replyId
router.delete(
  '/replies/:replyId',
  authMiddleware, orgScopeMiddleware, denyRole('analyst'), checkBanMuteMiddleware, writeRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await repliesService.deleteReply(req.params.orgId, req.params.replyId, req.user!.id, req.user!.role);
      res.status(204).send();
    } catch (err) { next(err); }
  },
);

export default router;
