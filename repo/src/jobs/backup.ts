import { exec } from 'child_process';
import { logger } from '../config/logger';

export function backupJob(): void {
  exec('/bin/sh /app/scripts/backup.sh', (error, stdout, stderr) => {
    if (error) {
      logger.error({ error: error.message, stderr }, 'Backup failed');
      return;
    }
    logger.info({ stdout: stdout.trim() }, 'Backup completed');
  });
}
