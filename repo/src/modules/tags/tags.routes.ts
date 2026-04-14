import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { authMiddleware } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { orgScopeMiddleware } from '../../middleware/orgScope';
import { writeRateLimiter, readRateLimiter } from '../../middleware/rateLimiter';
import { createTagSchema, updateTagSchema, listTagsQuerySchema } from './tags.schema';
import * as tagsService from './tags.service';

const router = Router({ mergeParams: true });

router.post(
  '/',
  authMiddleware, orgScopeMiddleware, requireRole('admin', 'moderator'), writeRateLimiter,
  validate({ body: createTagSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tag = await tagsService.createTag(req.params.orgId, req.body);
      res.status(201).json({ tag });
    } catch (err) { next(err); }
  },
);

router.get(
  '/',
  authMiddleware, orgScopeMiddleware, readRateLimiter,
  validate({ query: listTagsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tags = await tagsService.listTags(req.params.orgId, req.query.category as string | undefined);
      res.status(200).json({ data: tags });
    } catch (err) { next(err); }
  },
);

router.put(
  '/:tagId',
  authMiddleware, orgScopeMiddleware, requireRole('admin', 'moderator'), writeRateLimiter,
  validate({ body: updateTagSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tag = await tagsService.updateTag(req.params.orgId, req.params.tagId, req.body);
      res.status(200).json({ tag });
    } catch (err) { next(err); }
  },
);

router.delete(
  '/:tagId',
  authMiddleware, orgScopeMiddleware, requireRole('admin'), writeRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await tagsService.deleteTag(req.params.orgId, req.params.tagId);
      res.status(204).send();
    } catch (err) { next(err); }
  },
);

export default router;
