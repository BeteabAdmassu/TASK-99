#!/bin/sh
set -e

echo "Waiting for MySQL..."
until mysqladmin ping -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" --skip-ssl --silent 2>/dev/null; do
  sleep 2
done
echo "MySQL is ready."

echo "Running migrations..."
npx prisma migrate deploy

echo "Running seed..."
npx prisma db seed || echo "Seed already applied or skipped"

echo "Starting server..."
exec node dist/server.js
