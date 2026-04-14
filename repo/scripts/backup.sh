#!/bin/sh
set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="civicforum_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

mysqldump -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
  --single-transaction --routines --triggers | gzip > "$BACKUP_DIR/$FILENAME"

echo "Backup created: $FILENAME"

# Purge old backups
find "$BACKUP_DIR" -name "civicforum_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Old backups purged (retention: ${RETENTION_DAYS} days)"
