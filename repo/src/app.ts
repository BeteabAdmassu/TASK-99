import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import pinoHttp from 'pino-http';

import { logger } from './config/logger';
import { correlationIdMiddleware } from './middleware/correlationId';
import { errorHandler } from './middleware/errorHandler';
import { NotFoundError } from './utils/errors';

// Route imports
import authRoutes from './modules/auth/auth.routes';
import organizationsRoutes from './modules/organizations/organizations.routes';
import usersRoutes from './modules/users/users.routes';
import sectionsRoutes from './modules/sections/sections.routes';
import threadsRoutes from './modules/threads/threads.routes';
import repliesRoutes from './modules/replies/replies.routes';
import tagsRoutes from './modules/tags/tags.routes';
import moderationRoutes from './modules/moderation/moderation.routes';
import reportsRoutes from './modules/reports/reports.routes';
import announcementsRoutes from './modules/announcements/announcements.routes';
import carouselRoutes from './modules/carousel/carousel.routes';
import venuesRoutes from './modules/venues/venues.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import subscriptionsRoutes from './modules/subscriptions/subscriptions.routes';
import auditRoutes from './modules/audit/audit.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import anomaliesRoutes from './modules/anomalies/anomalies.routes';
import featureFlagsRoutes from './modules/feature-flags/feature-flags.routes';

const app = express();

// 1. Security headers
app.use(helmet());

// 2. CORS
app.use(cors());

// 3. Compression
app.use(compression());

// 4. Parse JSON bodies
app.use(express.json({ limit: '1mb' }));

// 5. Correlation ID
app.use(correlationIdMiddleware);

// 6. Request logging
app.use(pinoHttp({
  logger,
  customProps: (req) => ({
    correlationId: (req as any).correlationId,
  }),
}));

// 7. Health check (before auth)
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// 8. Auth routes (login is public)
app.use('/api/auth', authRoutes);

// 9. Organization routes
app.use('/api/organizations', organizationsRoutes);

// 10. Org-scoped routes
app.use('/api/organizations/:orgId/users', usersRoutes);
app.use('/api/organizations/:orgId', sectionsRoutes);
app.use('/api/organizations/:orgId/threads', threadsRoutes);
app.use('/api/organizations/:orgId', repliesRoutes);
app.use('/api/organizations/:orgId/tags', tagsRoutes);
app.use('/api/organizations/:orgId', moderationRoutes);
app.use('/api/organizations/:orgId', reportsRoutes);
app.use('/api/organizations/:orgId/announcements', announcementsRoutes);
app.use('/api/organizations/:orgId/carousel', carouselRoutes);
app.use('/api/organizations/:orgId', venuesRoutes);
app.use('/api/organizations/:orgId/notifications', notificationsRoutes);
app.use('/api/organizations/:orgId/subscriptions', subscriptionsRoutes);
app.use('/api/organizations/:orgId/audit-logs', auditRoutes);
app.use('/api/organizations/:orgId/analytics', analyticsRoutes);
app.use('/api/organizations/:orgId/anomalies', anomaliesRoutes);
app.use('/api/organizations/:orgId/feature-flags', featureFlagsRoutes);

// 29. 404 handler
app.use((_req, _res, next) => {
  next(new NotFoundError('Route not found'));
});

// 30. Global error handler
app.use(errorHandler);

// app.ts only assembles the Express application.
// Database connection, scheduler start, and port binding are handled by server.ts
// so that importing this module in tests does not start any network listeners.
export { app };
