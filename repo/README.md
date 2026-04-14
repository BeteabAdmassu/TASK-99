# CivicForum Operations Platform

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

### Default Credentials

- **Organization ID**: `00000000-0000-0000-0000-000000000001`
- **Admin Username**: `admin`
- **Admin Password**: `Admin12345678!`

### Running Tests

```bash
./run_tests.sh
```

This runs HTTP integration tests against the running Docker services, covering:
- Health check
- Authentication (login, logout, token validation)
- User CRUD and role management
- Forum sections and subsections
- Thread CRUD with state management (pin, lock, archive)
- Replies with nesting depth enforcement
- Tags with org-scoped slug uniqueness
- Moderation (bulk actions, recycle bin)
- Reports
- Announcements and carousel
- Venues and booking conflict validation
- Notifications and subscriptions
- Audit logs and analytics
- Anomaly flags
- Feature flags
- Error handling (401, 403, 404, 409)

### Stopping the Application

```bash
docker compose down
```

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
│   ├── app.ts                  # Express app assembly + server start
│   ├── config/
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
│   ├── setup.ts                # Test setup/teardown
│   ├── helpers.ts              # Test utilities
│   └── integration/            # Integration test suites
├── docker-compose.yml          # MySQL + app services
├── Dockerfile                  # Multi-stage build (node:20-alpine)
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── jest.config.ts              # Jest configuration
└── run_tests.sh                # HTTP integration tests
```

## Environment Variables

All environment variables have defaults in `docker-compose.yml`. No `.env` file is needed.

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| NODE_ENV | production | Environment |
| DATABASE_URL | mysql://... | Prisma connection string |
| JWT_SECRET | (set in compose) | JWT signing secret (min 32 chars) |
| JWT_EXPIRES_IN | 24h | Token expiration |
| BCRYPT_ROUNDS | 12 | Password hash rounds |
| ENCRYPTION_KEY | (set in compose) | AES-256 key (64 hex chars) |
| RATE_LIMIT_WRITE | 120 | Write requests per minute |
| RATE_LIMIT_READ | 600 | Read requests per minute |
| LOG_LEVEL | info | Pino log level |
| BACKUP_DIR | /backups | Backup storage path |
| BACKUP_RETENTION_DAYS | 14 | Backup retention period |

## Key Features

- **Multi-tenant**: All data scoped by organization
- **Role-based access**: Admin, Moderator, Analyst, User
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
