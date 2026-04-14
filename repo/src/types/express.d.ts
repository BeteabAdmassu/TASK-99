import { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      tokenJti?: string;
      organizationId?: string;
      user?: {
        id: string;
        username: string;
        role: UserRole;
        organizationId: string;
        isBanned: boolean;
        isMuted: boolean;
        mutedUntil: Date | null;
      };
    }
  }
}

export {};
