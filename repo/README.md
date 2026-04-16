# CivicForum Operations Platform

**Project Type: backend**

## Description

A self-contained, offline-first community forum backend that enables multi-tenant organizations to manage discussions, moderate content, configure operational resources, and audit all activity -- with zero external network dependencies. Built with Express.js, TypeScript, Prisma ORM, and MySQL.

## Prerequisites

- Docker 20+ and Docker Compose
- bash, curl, jq (for running integration tests)

## Getting Started

### Running the Application

```bash
docker compose up --build -d
```

This will:
1. Start a MySQL 8.0 database with binlog enabled
2. Build and start the application server
3. Automatically run Prisma migrations
4. Seed the database with a default organization and admin user

The API will be available at `http://localhost:3000`.

### Stopping the Application

```bash
docker compose down
```

## Demo Credentials

All requests are scoped to an organization. The default seeded organization is:

| Field | Value |
|-------|-------|
| Organization ID | `00000000-0000-0000-0000-000000000001` |

### Seeded Admin Account

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `Admin12345678!` |
| Role | `admin` |

The admin password is sourced from the `SEED_ADMIN_PASSWORD` environment variable at seed time. The dev default shown above is set in `docker-compose.yml`.

> **Security note**: All secrets in `docker-compose.yml` (`SEED_ADMIN_PASSWORD`, `JWT_SECRET`, `ENCRYPTION_KEY`, `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`, `DB_PASSWORD`) are development placeholders only. In production, supply them via an externally managed secret (Docker Swarm secret, Kubernetes secret, or a secrets manager) and never commit real values to source control.

### Creating Non-Admin Users (moderator, analyst, user)

Only the admin account is seeded automatically. The moderator, analyst, and user roles must be created via the admin API after startup. Run the following commands inside a running Docker environment (requires only `curl` and `jq`):

**Step 1 — Obtain an admin token:**

```bash
TOKEN=$(curl -s http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin12345678!","organizationId":"00000000-0000-0000-0000-000000000001"}' \
  | jq -r '.token')
```

**Step 2 — Create each role:**

```bash
ORG="00000000-0000-0000-0000-000000000001"

# Create moderator
curl -s -X POST "http://localhost:3000/api/organizations/$ORG/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"username":"demo_moderator","password":"DemoPassword123!","role":"moderator"}'

# Create analyst
curl -s -X POST "http://localhost:3000/api/organizations/$ORG/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"username":"demo_analyst","password":"DemoPassword123!","role":"analyst"}'

# Create regular user
curl -s -X POST "http://localhost:3000/api/organizations/$ORG/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"username":"demo_user","password":"DemoPassword123!","role":"user"}'
```

After creation, the complete demo credentials are:

| Role | Username | Password | Organization ID |
|------|----------|----------|-----------------|
| admin | `admin` | `Admin12345678!` | `00000000-0000-0000-0000-000000000001` |
| moderator | `demo_moderator` | `DemoPassword123!` | `00000000-0000-0000-0000-000000000001` |
| analyst | `demo_analyst` | `DemoPassword123!` | `00000000-0000-0000-0000-000000000001` |
| user | `demo_user` | `DemoPassword123!` | `00000000-0000-0000-0000-000000000001` |

## Verify the System Works

After `docker compose up --build -d` and waiting for the health check to pass, run these curl commands to confirm the system is operational.

### 1. Health check

```bash
curl -s http://localhost:3000/api/health | jq .
```

Expected response (HTTP 200):

```json
{
  "status": "ok",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

### 2. Admin login

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin12345678!","organizationId":"00000000-0000-0000-0000-000000000001"}' | jq .
```

Expected response (HTTP 200):

```json
{
  "token": "<jwt-string>",
  "user": {
    "id": "00000000-0000-0000-0000-000000000002",
    "username": "admin",
    "role": "admin",
    "organizationId": "00000000-0000-0000-0000-000000000001"
  }
}
```

### 3. Access a protected endpoint with Bearer token

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin12345678!","organizationId":"00000000-0000-0000-0000-000000000001"}' \
  | jq -r '.token')

curl -s http://localhost:3000/api/organizations/00000000-0000-0000-0000-000000000001/users \
  -H "Authorization: Bearer $TOKEN" | jq '{total: .total, first_user: .data[0].username}'
```

Expected response (HTTP 200):

```json
{
  "total": 1,
  "first_user": "admin"
}
```

### 4. Unauthenticated request is rejected (401)

```bash
curl -s http://localhost:3000/api/organizations/00000000-0000-0000-0000-000000000001/threads | jq .
```

Expected response (HTTP 401):

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### 5. Role-based access — analyst denied write access (403)

After creating the demo_analyst user (see Demo Credentials above):

```bash
# Login as analyst
ANALYST_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo_analyst","password":"DemoPassword123!","organizationId":"00000000-0000-0000-0000-000000000001"}' \
  | jq -r '.token')

# Attempt to create a thread (analyst is read-only — should return 403)
curl -s -X POST "http://localhost:3000/api/organizations/00000000-0000-0000-0000-000000000001/threads" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANALYST_TOKEN" \
  -d '{"subsectionId":"any","title":"Test","body":"Test"}' | jq .
```

Expected response (HTTP 403):

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions"
  }
}
```

## Running Tests

```bash
./run_tests.sh
```

This executes two phases:
1. **Phase 1 — HTTP API tests** (`tests/api_tests.sh`): curl-based checks against the running Docker services covering all CRUD flows, auth, validation errors, and edge cases.
2. **Phase 2 — Jest test suite** (Dockerized): unit tests for core utilities (errors, masks, pagination, encryption, middleware) and integration tests for security rules, scheduled jobs, response contracts, and audit remediation — all executed inside a Docker test-runner container.

Both phases must pass for `run_tests.sh` to exit 0.

## Project Structure

```
repo/
├── prisma/
│   ├── schema.prisma           # Database schema (22 models)
│   ├── seed.ts                 # Default org + admin seeding
│   └── migrations/             # SQL migrations
├── scripts/
│   ├── entrypoint.sh           # Docker entrypoint (wait, migrate, seed, start)
│   └── backup.sh               # MySQL backup with 14-day retention
├── src/
│   ├── app.ts                  # Express app assembly (no side effects on import)
│   ├── server.ts               # Bootstrap entry: DB connect, scheduler start, port bind
│   ├── config/
│   │   ├── appConfig.ts        # Feature-flag-driven runtime config
│   │   ├── database.ts         # Prisma client singleton
│   │   ├── encryption.ts       # AES-256-GCM encrypt/decrypt
│   │   ├── env.ts              # Zod-validated env vars
│   │   └── logger.ts           # Pino logger with PII masking
│   ├── jobs/
│   │   ├── scheduler.ts        # Cron job registration
│   │   ├── anomalyDetection.ts # Anomaly detection rules
│   │   ├── backup.ts           # Nightly backup trigger
│   │   ├── muteExpiry.ts       # Auto-clear expired mutes
│   │   ├── notificationRetry.ts# Retry failed notifications
│   │   ├── notificationScheduled.ts
│   │   ├── recycleBinPurge.ts  # 30-day auto-purge
│   │   └── tokenCleanup.ts     # Expired token cleanup
│   ├── middleware/
│   │   ├── auth.ts             # JWT verification + blacklist
│   │   ├── checkBanMute.ts     # Block banned/muted users
│   │   ├── correlationId.ts    # X-Correlation-ID header
│   │   ├── errorHandler.ts     # Global error handler
│   │   ├── orgScope.ts         # Organization scope check
│   │   ├── rateLimiter.ts      # Read/write rate limits
│   │   ├── rbac.ts             # Role-based access control
│   │   └── validate.ts         # Zod validation middleware
│   ├── modules/
│   │   ├── analytics/          # Funnel metrics aggregation
│   │   ├── anomalies/          # Anomaly detection + flags
│   │   ├── announcements/      # Announcement CRUD
│   │   ├── audit/              # Append-only audit logs
│   │   ├── auth/               # Login, logout, password
│   │   ├── carousel/           # Carousel item management
│   │   ├── feature-flags/      # Feature flag CRUD
│   │   ├── moderation/         # Bulk actions, recycle bin
│   │   ├── notifications/      # In-app notifications
│   │   ├── organizations/      # Organization management
│   │   ├── replies/            # Reply CRUD with nesting
│   │   ├── reports/            # Thread reports
│   │   ├── sections/           # Section + subsection CRUD
│   │   ├── subscriptions/      # Notification subscriptions
│   │   ├── tags/               # Tag taxonomy management
│   │   ├── threads/            # Thread CRUD + state
│   │   ├── users/              # User management + ban/mute
│   │   └── venues/             # Venue + booking management
│   ├── types/
│   │   └── express.d.ts        # Express type augmentation
│   └── utils/
│       ├── errors.ts           # Custom error classes
│       ├── masks.ts            # PII masking functions
│       └── pagination.ts       # Pagination helpers
├── tests/
│   ├── jest-setup-env.ts       # Env var defaults for test workers
│   ├── setup.ts                # Test setup/teardown
│   ├── helpers.ts              # Test utilities
│   ├── api_tests.sh            # HTTP integration tests (curl)
│   ├── unit/                   # Unit tests (errors, masks, pagination, etc.)
│   └── integration/            # Integration test suites
├── docker-compose.yml          # MySQL + app + test-runner services
├── Dockerfile                  # Multi-stage build (node:20-alpine)
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── jest.config.ts              # Jest configuration
└── run_tests.sh                # Test orchestrator (HTTP + Dockerized Jest)
```

## Environment Variables

All environment variables have defaults in `docker-compose.yml`. No `.env` file is needed.

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| NODE_ENV | production | Environment |
| DATABASE_URL | mysql://... | Prisma connection string |
| JWT_SECRET | (set in compose) | JWT signing secret (min 32 chars) |
| JWT_EXPIRES_IN | 86400 | Token expiration in **seconds** (86400 = 24 hours) |
| BCRYPT_ROUNDS | 12 | Password hash rounds |
| ENCRYPTION_KEY | (set in compose) | AES-256 key (64 hex chars) |
| SEED_ADMIN_PASSWORD | (set in compose) | Admin password used during DB seeding |
| RATE_LIMIT_WRITE | 120 | Write requests per minute |
| RATE_LIMIT_READ | 600 | Read requests per minute |
| LOG_LEVEL | info | Pino log level |
| BACKUP_DIR | /backups | Backup storage path |
| BACKUP_RETENTION_DAYS | 14 | Backup retention period |

## Key Features

- **Multi-tenant**: All data scoped by organization
- **Role-based access**: Admin, Moderator, Analyst (read-only), User
- **Forum management**: Sections, subsections, threads, replies (3-level nesting)
- **Moderation**: Ban/mute users, bulk actions, recycle bin with 30-day retention
- **Venue bookings**: Conflict-free room booking with overlap detection
- **Notifications**: In-app with retry logic and scheduled delivery
- **Audit trail**: Append-only logs for all significant actions
- **Analytics**: View-to-engagement funnel metrics
- **Anomaly detection**: Rule-based flagging for suspicious activity
- **Feature flags**: Database-stored, audited configuration toggles
- **Security**: bcrypt passwords, AES-256-GCM encryption, JWT auth, rate limiting
- **Nightly backups**: Automated MySQL dumps with 14-day retention
- **Point-in-time recovery**: Binlog-enabled restore via `mysqlbinlog` replay against nightly `.sql.gz` dumps

## Database Backup and Recovery

The database runs with binlog enabled (`--binlog-format=ROW`). Nightly logical backups are written to the `backups` Docker volume.

To restore to a point in time: decompress the nearest prior dump into the database, then use `mysqlbinlog --start-position=<pos> --stop-datetime=<target>` to extract and replay the binlog events that followed the dump. Verify row counts and the maximum `created_at` value in `audit_logs` to confirm the recovery point.
