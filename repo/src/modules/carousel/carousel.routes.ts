import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { authMiddleware } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { orgScopeMiddleware } from '../../middleware/orgScope';
import { writeRateLimiter, readRateLimiter } from '../../middleware/rateLimiter';
import { createCarouselSchema, updateCarouselSchema, listCarouselQuerySchema } from './carousel.schema';
import * as carouselService from './carousel.service';

const router = Router({ mergeParams: true });

router.post(
  '/',
  authMiddleware, orgScopeMiddleware, requireRole('admin'), writeRateLimiter,
  validate({ body: createCarouselSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await carouselService.createCarouselItem(req.params.orgId, req.user!.id, req.body);
      res.status(201).json({ item });
    } catch (err) { next(err); }
  },
);

router.get(
  '/',
  authMiddleware, orgScopeMiddleware, readRateLimiter,
  validate({ query: listCarouselQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const includeExpired = req.query.includeExpired === 'true';
      const items = await carouselService.listCarouselItems(req.params.orgId, includeExpired);
      res.status(200).json({ data: items });
    } catch (err) { next(err); }
  },
);

router.put(
  '/:id',
  authMiddleware, orgScopeMiddleware, requireRole('admin'), writeRateLimiter,
  validate({ body: updateCarouselSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await carouselService.updateCarouselItem(req.params.orgId, req.params.id, req.body, req.user!.id);
      res.status(200).json({ item });
    } catch (err) { next(err); }
  },
);

router.delete(
  '/:id',
  authMiddleware, orgScopeMiddleware, requireRole('admin'), writeRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await carouselService.deleteCarouselItem(req.params.orgId, req.params.id, req.user!.id);
      res.status(204).send();
    } catch (err) { next(err); }
  },
);

export default router;
