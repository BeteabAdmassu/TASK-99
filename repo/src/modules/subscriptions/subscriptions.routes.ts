import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { authMiddleware } from '../../middleware/auth';
import { orgScopeMiddleware } from '../../middleware/orgScope';
import { writeRateLimiter, readRateLimiter } from '../../middleware/rateLimiter';
import { updateSubscriptionSchema } from './subscriptions.schema';
import * as subscriptionsService from './subscriptions.service';

const router = Router({ mergeParams: true });

router.get(
  '/',
  authMiddleware, orgScopeMiddleware, readRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const subscriptions = await subscriptionsService.listSubscriptions(req.params.orgId, req.user!.id);
      res.status(200).json({ data: subscriptions });
    } catch (err) { next(err); }
  },
);

router.put(
  '/',
  authMiddleware, orgScopeMiddleware, writeRateLimiter,
  validate({ body: updateSubscriptionSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const subscription = await subscriptionsService.updateSubscription(
        req.params.orgId, req.user!.id, req.body.category, req.body.isSubscribed,
      );
      res.status(200).json({ subscription });
    } catch (err) { next(err); }
  },
);

export default router;
