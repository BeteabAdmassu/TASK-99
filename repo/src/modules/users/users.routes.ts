import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { authMiddleware } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { orgScopeMiddleware } from '../../middleware/orgScope';
import { writeRateLimiter, readRateLimiter } from '../../middleware/rateLimiter';
import { createUserSchema, listUsersQuerySchema, updateRoleSchema, banUserSchema, muteUserSchema } from './users.schema';
import * as usersService from './users.service';

const router = Router({ mergeParams: true });

router.post(
  '/',
  authMiddleware,
  orgScopeMiddleware,
  requireRole('admin'),
  writeRateLimiter,
  validate({ body: createUserSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.createUser(req.params.orgId, req.body, req.user!.id);
      res.status(201).json({ user });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/',
  authMiddleware,
  orgScopeMiddleware,
  requireRole('admin', 'moderator', 'analyst'),
  readRateLimiter,
  validate({ query: listUsersQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await usersService.listUsers(req.params.orgId, req.query, req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/:userId',
  authMiddleware,
  orgScopeMiddleware,
  requireRole('admin', 'moderator', 'analyst'),
  readRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.getUser(req.params.orgId, req.params.userId);
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  '/:userId/role',
  authMiddleware,
  orgScopeMiddleware,
  requireRole('admin'),
  writeRateLimiter,
  validate({ body: updateRoleSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.updateRole(req.params.orgId, req.params.userId, req.body.role, req.user!.id);
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:userId/ban',
  authMiddleware,
  orgScopeMiddleware,
  requireRole('admin', 'moderator'),
  writeRateLimiter,
  validate({ body: banUserSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.banUser(req.params.orgId, req.params.userId, req.user!.id, req.body.reason);
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:userId/unban',
  authMiddleware,
  orgScopeMiddleware,
  requireRole('admin', 'moderator'),
  writeRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.unbanUser(req.params.orgId, req.params.userId, req.user!.id);
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:userId/mute',
  authMiddleware,
  orgScopeMiddleware,
  requireRole('admin', 'moderator'),
  writeRateLimiter,
  validate({ body: muteUserSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.muteUser(
        req.params.orgId, req.params.userId, req.user!.id,
        req.body.durationHours, req.body.reason,
      );
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:userId/unmute',
  authMiddleware,
  orgScopeMiddleware,
  requireRole('admin', 'moderator'),
  writeRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.unmuteUser(req.params.orgId, req.params.userId, req.user!.id);
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
