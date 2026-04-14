import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { startScheduler, stopScheduler } from './jobs/scheduler';

async function startServer(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connected');

    startScheduler();

    const server = app.listen(env.PORT, () => {
      logger.info(`Server started on port ${env.PORT}`);
    });

    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully`);
      stopScheduler();
      server.close();
      await prisma.$disconnect();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

startServer();
