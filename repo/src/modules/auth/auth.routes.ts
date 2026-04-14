import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { validate } from '../../middleware/validate';
import { authMiddleware } from '../../middleware/auth';
import { loginSchema, changePasswordSchema } from './auth.schema';
import * as authService from './auth.service';

const router = Router();

router.post(
  '/login',
  validate({ body: loginSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, password, organizationId } = req.body;
      const ipAddress = req.ip || req.socket.remoteAddress;
      const result = await authService.login(username, password, organizationId, ipAddress);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/logout',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization!.slice(7);
      const decoded = jwt.decode(token) as { exp: number; jti: string };
      await authService.logout(decoded.jti, new Date(decoded.exp * 1000));
      res.status(200).json({ message: 'Logged out' });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/me',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await authService.getMe(req.user!.id);
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  '/password',
  authMiddleware,
  validate({ body: changePasswordSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = req.body;
      await authService.changePassword(req.user!.id, currentPassword, newPassword);
      res.status(200).json({ message: 'Password updated' });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
