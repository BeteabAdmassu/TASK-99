#!/bin/bash
# Test runner - ensures services are running, waits for readiness, then
# executes the API test suite.

set -euo pipefail

BASE_URL="http://localhost:3000/api"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Bring services up (idempotent — no-op if already running, starts them if
# the CI harness stopped containers between the build and test phases).
echo "Starting services..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d
set +e   # health-check loop must not abort on non-zero curl exit

# Wait for service to be healthy before running any tests
echo "Waiting for service to be healthy..."
RETRIES=0
MAX_RETRIES=60
until curl -sf "$BASE_URL/health" > /dev/null 2>&1; do
  RETRIES=$((RETRIES + 1))
  if [ $RETRIES -ge $MAX_RETRIES ]; then
    echo "ERROR: Service did not become healthy after ${MAX_RETRIES} attempts"
    exit 1
  fi
  sleep 3
done
echo "Service is healthy!"

# Run the API test suite
bash "$SCRIPT_DIR/tests/api_tests.sh"
