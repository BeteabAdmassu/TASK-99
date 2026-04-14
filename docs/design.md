# CivicForum Operations Platform — Design Document

## Business Goal

Deliver a self-contained, offline-first community forum backend that enables multi-tenant organizations to manage discussions, moderate content, configure operational resources, and audit all activity — with zero external network dependencies.

---

## Core Requirements

### Authentication & Identity
1. Users authenticate via username + password only (no OAuth, no email verification)
2. Passwords must be minimum 12 characters
3. Passwords stored using salted bcrypt hashing
4. Account lockout after 5 failed login attempts within a 15-minute window
5. Lockout clears automatically after the 15-minute window expires
6. Auth enforced via locally-stored signed JWT tokens
7. All API routes (except login and health) require valid authentication

### Role-Based Access Control
8. Four roles: Administrator, Moderator, Analyst, Regular User
9. Administrator: full access to all operations within their organization
10. Moderator: content moderation, ban/mute users, bulk content actions
11. Analyst: read-only access to operations data and reporting dashboards
12. Regular User: create/read/update own threads and replies, manage own subscriptions
13. Roles are scoped per organization (a user has one role per org)

### Multi-Tenancy (Organizations)
14. All user-generated entities scoped by organizationId
15. organizationId indexed on all tenant-scoped tables
16. Username must be unique per organization (not globally)
17. Users cannot access resources from other organizations
18. Administrators can manage organization settings

### Forum Sections & Subsections
19. Organizations contain forum sections (top-level categories)
20. Sections contain subsections (one level of nesting)
21. Sections and subsections have a display order
22. Sections/subsections can be created, updated, deleted, and listed

### Threads
23. Threads belong to a subsection
24. Threads have a title, body content, author, and creation timestamp
25. Threads support state flags: pinned, featured, locked, archived
26. Locked threads block new replies
27. Archived threads block edits (to the thread and its replies)
28. Pinned threads limited to maximum 3 per section (across all subsections in that section)
29. Threads can have tags applied to them
30. Threads support CRUD operations (create, read, update, soft-delete)
31. Thread listing supports query/filtering and pagination

### Replies
32. Replies belong to a thread
33. Replies support nesting up to 3 levels (reply → reply → reply)
34. Nesting enforced server-side: attempts to nest beyond level 3 are rejected
35. Replies have body content, author, and creation timestamp
36. Replies support CRUD operations
37. Replies cannot be added to locked threads
38. Replies cannot be edited in archived threads

### Tags / Topic Taxonomy
39. Tags belong to an organization
40. Tag slug must be unique per organization
41. Tags have a name and a slug
42. Tags can be applied to and removed from threads
43. Tags can be created, updated, deleted, and listed
44. Tags can be organized into categories (tag dictionaries)

### Moderation & Back-Office
45. Moderators/Admins can ban users (prevents all activity)
46. Moderators/Admins can unban users
47. Moderators/Admins can mute users for a duration (24 hours to 30 days)
48. Muted users cannot create new content but can read
49. Moderators/Admins can unmute users early
50. Moderators/Admins can perform bulk content actions (e.g., bulk delete, bulk lock, bulk archive)
51. Deleted content goes to a recycle bin (soft delete)
52. Recycle bin retains items for 30 days
53. Items in recycle bin can be restored within 30 days
54. Items in recycle bin are permanently purged after 30 days
55. Permission updates (role changes) are logged and auditable

### Admin Configuration
56. Organization management: create, update org settings
57. Category/tag dictionary management
58. Announcements: ordered items with start and end timestamps
59. Carousel configuration: ordered items with start and end timestamps
60. Venue resources: rooms/spaces that can be booked
61. Venue bookings with conflict validation: no overlapping bookings in same room
62. Feature flags stored in database and audited on change

### Messaging & Notification Center
63. In-app notification records only (no SMS, email, WeChat, or external integrations)
64. Notifications triggered by events: new reply to subscribed thread, moderation action against user, announcement published
65. Scheduled delivery support (time-based jobs for deferred notifications)
66. Per-user subscription management: opt-in per category
67. Security notices default to opt-in (cannot be unsubscribed)
68. Track delivery timestamp and open/read timestamp per notification
69. Retry failed deliveries up to 3 times with exponential backoff
70. Retry window: within 24 hours of original attempt
71. All notification processing runs locally

### Data & Risk Audit
72. Append-only audit log with immutable auditLogId
73. Log events: login, permission changes, moderation actions, configuration changes
74. Dashboard: aggregated funnel metrics (view → registration → post → engagement)
75. Funnel metrics computed from event tables, no third-party analytics
76. Abnormal behavior detection via local rules engine
77. Rule: ≥10 thread deletions within 1 hour flags the user
78. Rule: ≥20 cancellations/undos within 1 hour flags the user
79. Rule: ≥5 reports on a thread within 30 minutes flags content for review
80. Flagged anomalies generate alerts in structured logs

### Security & Data Protection
81. Sensitive fields (e.g., email) encrypted at rest using AES-256
82. Personal identifiers masked in all log output
83. Passwords never logged or returned in API responses
84. Stack traces never exposed in API responses

### Backup & Recovery
85. Nightly automated local backups to an attached Docker volume
86. 14-day backup retention (older backups purged automatically)
87. Point-in-time recovery via MySQL binlog where available
88. Backup script runs as a cron job inside the container

### Performance & Infrastructure
89. Rate limiting per user: 120 write actions/minute, 600 reads/minute
90. Structured JSON logging with correlation IDs (request tracing)
91. Alerting via local log thresholds only (no external alerting services)
92. p95 read latency under 300ms for common queries at 500 concurrent users
93. Single Docker-deployable service with no external network dependencies
94. All configuration via feature flags in database

---

## Main User Flow (Regular User — Thread Creation & Discussion)

1. User sends `POST /api/auth/login` with `{username, password, organizationId}` → receives 200 with JWT token and user profile
2. User sends `GET /api/organizations/:orgId/sections` with token → receives list of forum sections with nested subsections, ordered by displayOrder
3. User picks a subsection, sends `GET /api/organizations/:orgId/threads?subsectionId=X&page=1&limit=20` → sees paginated thread list (pinned threads first, then by latest activity descending)
4. User sends `POST /api/organizations/:orgId/threads` with `{subsectionId, title, body, tagIds?}` → thread created, 201 returned with thread object
5. Notification system detects new thread event → generates in-app notifications for users subscribed to that subsection's category
6. Other users view the thread via `GET /api/organizations/:orgId/threads/:threadId` → sees thread detail with paginated nested replies
7. A user replies via `POST /api/organizations/:orgId/threads/:threadId/replies` with `{body, parentReplyId?}` → reply created, 201 returned
8. Original thread author receives in-app notification of the new reply
9. Thread author can edit via `PUT /api/organizations/:orgId/threads/:threadId` with `{title?, body?}` → 200
10. Thread author can delete via `DELETE /api/organizations/:orgId/threads/:threadId` → 204, thread moves to recycle bin (soft delete)

---

## Additional User Flows

### Authentication Flow
1. `POST /api/auth/login` with valid credentials → 200 + `{token, user}` with role and org info
2. Login with wrong password → 401 + failed attempt recorded
3. 5th failed attempt within 15 minutes → 423 Locked with `lockedUntil` timestamp
4. After 15-minute window expires → lockout clears automatically, user can retry
5. Accessing any protected route without token → 401 Unauthorized
6. Accessing any protected route with expired/malformed token → 401 Unauthorized
7. `POST /api/auth/logout` → 200, token blacklisted or client-side discard

### Moderation Flow
1. Moderator browses threads or views reported content via `GET /api/organizations/:orgId/reports`
2. Moderator locks a thread → `PUT /api/organizations/:orgId/threads/:threadId/state` with `{isLocked: true}` → 200
3. Subsequent reply attempts on locked thread → 403 `THREAD_LOCKED`
4. Moderator bans a user → `POST /api/organizations/:orgId/users/:userId/ban` with `{reason?}` → 200
5. Banned user attempts any write operation → 403 `USER_BANNED`
6. Moderator mutes a user for 7 days → `POST /api/organizations/:orgId/users/:userId/mute` with `{durationHours: 168, reason?}` → 200
7. Muted user attempts to create content → 403 `USER_MUTED` with `mutedUntil`
8. Moderator performs bulk delete → `POST /api/organizations/:orgId/moderation/bulk-action` with `{action: "delete", resourceType: "thread", resourceIds: [...]}` → 200, items moved to recycle bin
9. Moderator restores item → `POST /api/organizations/:orgId/recycle-bin/:itemType/:itemId/restore` → 200

### Admin Configuration Flow
1. Admin creates announcement → `POST /api/organizations/:orgId/announcements` with `{title, body, displayOrder, startDate, endDate}` → 201
2. Admin configures carousel → `POST /api/organizations/:orgId/carousel` with item details → 201
3. Admin creates venue resource → `POST /api/organizations/:orgId/venues` with `{name, description?, capacity?}` → 201
4. User books venue → `POST /api/organizations/:orgId/venues/:venueId/bookings` with `{title, startTime, endTime}` → system validates no time overlap → 201 or 409 conflict
5. Admin manages feature flags → `PUT /api/organizations/:orgId/feature-flags/:flagId` with `{value}` → change audited in audit_logs

### Analyst Reporting Flow
1. Analyst queries funnel dashboard → `GET /api/organizations/:orgId/analytics/funnel?startDate=X&endDate=Y` → receives aggregated view → registration → post → engagement metrics
2. Analyst queries audit logs → `GET /api/organizations/:orgId/audit-logs?action=X&startDate=Y&endDate=Z&page=1` → paginated audit entries
3. Analyst views anomaly flags → `GET /api/organizations/:orgId/anomalies?status=open` → list of flagged users/content

### Error & Edge Cases
- Creating a 4th pinned thread in a section → 400 `PINNED_LIMIT_REACHED`
- Nesting a reply at depth > 3 → 400 `MAX_NESTING_DEPTH`
- Mute duration outside 24h–30d range → 400 validation error
- Booking a venue with time overlap → 409 `BOOKING_CONFLICT`
- Restoring item after 30-day retention → 404 item permanently purged
- Rate limit exceeded → 429 with `retryAfter`
- Accessing resource in different org → 403 `FORBIDDEN`

---

## Tech Stack

- **Backend**: Express.js + TypeScript
- **ORM**: Prisma
- **Database**: MySQL 8.0
- **Auth**: JWT (jsonwebtoken library) with locally-stored tokens
- **Password Hashing**: bcrypt (12 salt rounds)
- **Encryption**: AES-256-GCM for sensitive fields at rest (via Node.js crypto module)
- **Validation**: Zod
- **Logging**: Pino (structured JSON)
- **Rate Limiting**: express-rate-limit with in-memory store
- **Scheduling**: node-cron (for notification retry, recycle bin purge, anomaly detection, backup)
- **Testing**: Jest + supertest (integration), Jest (unit)
- **Containerization**: Docker + docker-compose
- **Backup**: mysqldump + MySQL binlog

---

## Database Schema

```
organizations
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID())
  name            VARCHAR(255) NOT NULL
  slug            VARCHAR(255) NOT NULL UNIQUE
  settings        JSON
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)

users
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID())
  organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
  username        VARCHAR(100) NOT NULL
  password_hash   VARCHAR(255) NOT NULL       -- bcrypt hash (12 rounds)
  email_encrypted VARBINARY(512)              -- AES-256-GCM encrypted, nullable
  role            ENUM('admin','moderator','analyst','user') NOT NULL DEFAULT 'user'
  is_banned       BOOLEAN NOT NULL DEFAULT FALSE
  banned_at       DATETIME(3)
  banned_by       VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL
  ban_reason      TEXT
  is_muted        BOOLEAN NOT NULL DEFAULT FALSE
  muted_until     DATETIME(3)
  muted_by        VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL
  mute_reason     TEXT
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
  UNIQUE INDEX idx_users_org_username (organization_id, username)
  INDEX idx_users_org (organization_id)

login_attempts
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID())
  user_id         VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE
  attempted_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  success         BOOLEAN NOT NULL
  ip_address      VARCHAR(45)
  INDEX idx_login_attempts_user_time (user_id, attempted_at)

account_lockouts
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID())
  user_id         VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE
  locked_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  expires_at      DATETIME(3) NOT NULL
  INDEX idx_lockouts_user (user_id)

forum_sections
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID())
  organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
  name            VARCHAR(255) NOT NULL
  description     TEXT
  display_order   INT NOT NULL DEFAULT 0
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
  INDEX idx_sections_org (organization_id)
  INDEX idx_sections_org_order (organization_id, display_order)

forum_subsections
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID())
  section_id      VARCHAR(36) NOT NULL REFERENCES forum_sections(id) ON DELETE CASCADE
  organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
  name            VARCHAR(255) NOT NULL
  description     TEXT
  display_order   INT NOT NULL DEFAULT 0
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
  INDEX idx_subsections_section (section_id)
  INDEX idx_subsections_org (organization_id)

threads
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID())
  organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
  subsection_id   VARCHAR(36) NOT NULL REFERENCES forum_subsections(id) ON DELETE CASCADE
  author_id       VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE
  title           VARCHAR(300) NOT NULL
  body            TEXT NOT NULL
  is_pinned       BOOLEAN NOT NULL DEFAULT FALSE
  is_featured     BOOLEAN NOT NULL DEFAULT FALSE
  is_locked       BOOLEAN NOT NULL DEFAULT FALSE
  is_archived     BOOLEAN NOT NULL DEFAULT FALSE
  view_count      INT NOT NULL DEFAULT 0
  reply_count     INT NOT NULL DEFAULT 0
  last_activity_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  deleted_at      DATETIME(3)                 -- soft delete for recycle bin
  deleted_by      VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
  INDEX idx_threads_org (organization_id)
  INDEX idx_threads_subsection (subsection_id)
  INDEX idx_threads_author (author_id)
  INDEX idx_threads_deleted (deleted_at)
  INDEX idx_threads_subsection_pinned (subsection_id, is_pinned)
  INDEX idx_threads_last_activity (subsection_id, last_activity_at DESC)

replies
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID())
  organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
  thread_id       VARCHAR(36) NOT NULL REFERENCES threads(id) ON DELETE CASCADE
  author_id       VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE
  parent_reply_id VARCHAR(36) REFERENCES replies(id) ON DELETE CASCADE
  depth           TINYINT NOT NULL DEFAULT 1    -- 1, 2, or 3; enforced by application
  body            TEXT NOT NULL
  deleted_at      DATETIME(3)                   -- soft delete for recycle bin
  deleted_by      VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
  INDEX idx_replies_thread (thread_id)
  INDEX idx_replies_org (organization_id)
  INDEX idx_replies_parent (parent_reply_id)
  INDEX idx_replies_author (author_id)
  INDEX idx_replies_deleted (deleted_at)

tags
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID())
  organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
  category        VARCHAR(100)                  -- tag dictionary/category grouping
  name            VARCHAR(100) NOT NULL
  slug            VARCHAR(100) NOT NULL
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
  UNIQUE INDEX idx_tags_org_slug (organization_id, slug)
  INDEX idx_tags_org (organization_id)
  INDEX idx_tags_category (organization_id, category)

thread_tags
  thread_id       VARCHAR(36) NOT NULL REFERENCES threads(id) ON DELETE CASCADE
  tag_id          VARCHAR(36) NOT NULL REFERENCES tags(id) ON DELETE CASCADE
  PRIMARY KEY (thread_id, tag_id)
  INDEX idx_thread_tags_tag (tag_id)

announcements
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID())
  organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
  title           VARCHAR(300) NOT NULL
  body            TEXT NOT NULL
  display_order   INT NOT NULL DEFAULT 0
  start_date      DATETIME(3) NOT NULL
  end_date        DATETIME(3) NOT NULL
  is_published    BOOLEAN NOT NULL DEFAULT FALSE
  created_by      VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
  INDEX idx_announcements_org (organization_id)
  INDEX idx_announcements_dates (organization_id, start_date, end_date)

carousel_items
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID())
  organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
  title           VARCHAR(300) NOT NULL
  image_url       VARCHAR(1000)
  link_url        VARCHAR(1000)
  display_order   INT NOT NULL DEFAULT 0
  start_date      DATETIME(3) NOT NULL
  end_date        DATETIME(3) NOT NULL
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
  created_by      VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
  INDEX idx_carousel_org (organization_id)
  INDEX idx_carousel_dates (organization_id, start_date, end_date)

venues
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID())
  organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
  name            VARCHAR(255) NOT NULL
  description     TEXT
  capacity        INT
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
  INDEX idx_venues_org (organization_id)

venue_bookings
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID())
  organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
  venue_id        VARCHAR(36) NOT NULL REFERENCES venues(id) ON DELETE CASCADE
  booked_by       VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE
  title           VARCHAR(255) NOT NULL
  start_time      DATETIME(3) NOT NULL
  end_time        DATETIME(3) NOT NULL
  status          ENUM('confirmed','cancelled') NOT NULL DEFAULT 'confirmed'
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
  INDEX idx_bookings_venue_time (venue_id, start_time, end_time)
  INDEX idx_bookings_org (organization_id)
  INDEX idx_bookings_user (booked_by)

notifications
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID())
  organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
  user_id         VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE
  type            VARCHAR(50) NOT NULL        -- 'new_reply', 'moderation_action', 'announcement', 'security'
  title           VARCHAR(300) NOT NULL
  body            TEXT NOT NULL
  reference_type  VARCHAR(50)                 -- 'thread', 'reply', 'announcement', etc.
  reference_id    VARCHAR(36)
  status          ENUM('pending','delivered','read','failed') NOT NULL DEFAULT 'pending'
  scheduled_at    DATETIME(3)                 -- for deferred delivery
  delivered_at    DATETIME(3)
  read_at         DATETIME(3)
  retry_count     TINYINT NOT NULL DEFAULT 0
  last_retry_at   DATETIME(3)
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  INDEX idx_notifications_user_status (user_id, status)
  INDEX idx_notifications_org (organization_id)
  INDEX idx_notifications_scheduled (status, scheduled_at)
  INDEX idx_notifications_retry (status, retry_count, last_retry_at)

notification_subscriptions
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID())
  user_id         VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE
  organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
  category        VARCHAR(100) NOT NULL       -- 'section:<id>', 'tag:<id>', 'thread:<id>', 'security'
  is_subscribed   BOOLEAN NOT NULL DEFAULT TRUE
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
  UNIQUE INDEX idx_subs_user_category (user_id, organization_id, category)
  INDEX idx_subs_org (organization_id)

audit_logs
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID())  -- immutable, append-only
  organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
  actor_id        VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL
  action          VARCHAR(100) NOT NULL       -- 'login', 'login_failed', 'permission_change', 'moderation_ban', 'moderation_mute', 'config_update', 'feature_flag_change', etc.
  resource_type   VARCHAR(50)                 -- 'user', 'thread', 'reply', 'tag', 'announcement', 'venue', 'feature_flag', etc.
  resource_id     VARCHAR(36)
  details         JSON                        -- action-specific payload (before/after values)
  ip_address      VARCHAR(45)
  correlation_id  VARCHAR(36)
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  INDEX idx_audit_org (organization_id)
  INDEX idx_audit_actor (actor_id)
  INDEX idx_audit_action (action)
  INDEX idx_audit_created (organization_id, created_at)
  INDEX idx_audit_resource (resource_type, resource_id)

event_logs
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID())
  organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
  user_id         VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL
  event_type      VARCHAR(50) NOT NULL        -- 'page_view', 'registration', 'post_created', 'engagement'
  metadata        JSON
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  INDEX idx_events_org_type (organization_id, event_type)
  INDEX idx_events_created (organization_id, created_at)
  INDEX idx_events_user (user_id)

anomaly_flags
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID())
  organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
  flagged_user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL
  flagged_thread_id VARCHAR(36) REFERENCES threads(id) ON DELETE SET NULL
  rule_name       VARCHAR(100) NOT NULL       -- 'excessive_deletions', 'excessive_undos', 'reported_content'
  description     TEXT NOT NULL
  severity        ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium'
  status          ENUM('open','acknowledged','resolved','dismissed') NOT NULL DEFAULT 'open'
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  resolved_at     DATETIME(3)
  resolved_by     VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL
  INDEX idx_anomalies_org (organization_id)
  INDEX idx_anomalies_status (organization_id, status)
  INDEX idx_anomalies_user (flagged_user_id)

feature_flags
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID())
  organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
  flag_key        VARCHAR(100) NOT NULL
  value           JSON NOT NULL               -- { "enabled": true, "config": {...} }
  description     VARCHAR(500)
  updated_by      VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
  UNIQUE INDEX idx_flags_org_key (organization_id, flag_key)

thread_reports
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID())
  organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
  thread_id       VARCHAR(36) NOT NULL REFERENCES threads(id) ON DELETE CASCADE
  reported_by     VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE
  reason          TEXT NOT NULL
  status          ENUM('pending','reviewed','dismissed') NOT NULL DEFAULT 'pending'
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  INDEX idx_reports_thread (thread_id)
  INDEX idx_reports_org (organization_id)
  INDEX idx_reports_thread_created (thread_id, created_at)

token_blacklist
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID())
  token_jti       VARCHAR(36) NOT NULL UNIQUE  -- JWT ID claim
  expires_at      DATETIME(3) NOT NULL         -- auto-cleanup after expiry
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  INDEX idx_blacklist_jti (token_jti)
  INDEX idx_blacklist_expires (expires_at)
```

---

## API Endpoints

### Health & System

| Method | Path | Auth | Role | Description | Request Body | Success Response | Error Responses |
|--------|------|------|------|-------------|-------------|-----------------|-----------------|
| GET | /api/health | No | — | Health check | — | 200 `{status:"ok",timestamp,version}` | — |

### Authentication

| Method | Path | Auth | Role | Description | Request Body | Success Response | Error Responses |
|--------|------|------|------|-------------|-------------|-----------------|-----------------|
| POST | /api/auth/login | No | — | Login | `{username, password, organizationId}` | 200 `{token, user:{id,username,role,organizationId}}` | 400 validation, 401 invalid credentials, 423 account locked |
| POST | /api/auth/logout | Yes | Any | Invalidate token | — | 200 `{message:"Logged out"}` | 401 |
| GET | /api/auth/me | Yes | Any | Get current user | — | 200 `{user}` | 401 |
| PUT | /api/auth/password | Yes | Any | Change own password | `{currentPassword, newPassword}` | 200 `{message:"Password updated"}` | 400 validation, 401 wrong current password |

### Organizations

| Method | Path | Auth | Role | Description | Request Body | Success Response | Error Responses |
|--------|------|------|------|-------------|-------------|-----------------|-----------------|
| POST | /api/organizations | Yes | Admin | Create organization | `{name, slug, settings?}` | 201 `{organization}` | 400, 409 slug exists |
| GET | /api/organizations/:orgId | Yes | Any | Get organization details | — | 200 `{organization}` | 401, 403, 404 |
| PUT | /api/organizations/:orgId | Yes | Admin | Update organization | `{name?, settings?}` | 200 `{organization}` | 400, 401, 403, 404 |

### Users

| Method | Path | Auth | Role | Description | Request Body | Success Response | Error Responses |
|--------|------|------|------|-------------|-------------|-----------------|-----------------|
| POST | /api/organizations/:orgId/users | Yes | Admin | Register new user | `{username, password, role?, email?}` | 201 `{user}` | 400 validation, 409 username taken |
| GET | /api/organizations/:orgId/users | Yes | Admin,Mod,Analyst | List users (paginated) | `?page,limit,role,search` | 200 `{data:users[],total,page,limit}` | 401, 403 |
| GET | /api/organizations/:orgId/users/:userId | Yes | Admin,Mod,Analyst | Get user detail | — | 200 `{user}` | 401, 403, 404 |
| PUT | /api/organizations/:orgId/users/:userId/role | Yes | Admin | Update user role | `{role}` | 200 `{user}` | 400, 401, 403, 404 |
| POST | /api/organizations/:orgId/users/:userId/ban | Yes | Admin,Mod | Ban user | `{reason?}` | 200 `{user}` | 401, 403, 404 |
| POST | /api/organizations/:orgId/users/:userId/unban | Yes | Admin,Mod | Unban user | — | 200 `{user}` | 401, 403, 404 |
| POST | /api/organizations/:orgId/users/:userId/mute | Yes | Admin,Mod | Mute user | `{durationHours, reason?}` | 200 `{user}` | 400, 401, 403, 404 |
| POST | /api/organizations/:orgId/users/:userId/unmute | Yes | Admin,Mod | Unmute user | — | 200 `{user}` | 401, 403, 404 |

### Forum Sections

| Method | Path | Auth | Role | Description | Request Body | Success Response | Error Responses |
|--------|------|------|------|-------------|-------------|-----------------|-----------------|
| POST | /api/organizations/:orgId/sections | Yes | Admin | Create section | `{name, description?, displayOrder?}` | 201 `{section}` | 400, 401, 403 |
| GET | /api/organizations/:orgId/sections | Yes | Any | List sections with subsections | `?includeSubsections=true` | 200 `{data:sections[]}` | 401 |
| GET | /api/organizations/:orgId/sections/:sectionId | Yes | Any | Get section detail | — | 200 `{section}` | 401, 404 |
| PUT | /api/organizations/:orgId/sections/:sectionId | Yes | Admin | Update section | `{name?, description?, displayOrder?}` | 200 `{section}` | 400, 401, 403, 404 |
| DELETE | /api/organizations/:orgId/sections/:sectionId | Yes | Admin | Delete section | — | 204 | 401, 403, 404 |

### Forum Subsections

| Method | Path | Auth | Role | Description | Request Body | Success Response | Error Responses |
|--------|------|------|------|-------------|-------------|-----------------|-----------------|
| POST | /api/organizations/:orgId/sections/:sectionId/subsections | Yes | Admin | Create subsection | `{name, description?, displayOrder?}` | 201 `{subsection}` | 400, 401, 403, 404 parent |
| GET | /api/organizations/:orgId/sections/:sectionId/subsections | Yes | Any | List subsections | — | 200 `{data:subsections[]}` | 401, 404 |
| PUT | /api/organizations/:orgId/subsections/:subId | Yes | Admin | Update subsection | `{name?, description?, displayOrder?}` | 200 `{subsection}` | 400, 401, 403, 404 |
| DELETE | /api/organizations/:orgId/subsections/:subId | Yes | Admin | Delete subsection | — | 204 | 401, 403, 404 |

### Threads

| Method | Path | Auth | Role | Description | Request Body | Success Response | Error Responses |
|--------|------|------|------|-------------|-------------|-----------------|-----------------|
| POST | /api/organizations/:orgId/threads | Yes | User+ | Create thread | `{subsectionId, title, body, tagIds?}` | 201 `{thread}` | 400, 401, 403 banned/muted |
| GET | /api/organizations/:orgId/threads | Yes | Any | List threads (paginated) | `?subsectionId,tagId,search,page,limit,sort` | 200 `{data:threads[],total,page,limit}` | 401 |
| GET | /api/organizations/:orgId/threads/:threadId | Yes | Any | Get thread detail | — | 200 `{thread}` | 401, 404 |
| PUT | /api/organizations/:orgId/threads/:threadId | Yes | Author,Mod,Admin | Update thread | `{title?, body?, tagIds?}` | 200 `{thread}` | 400, 401, 403 not owner/archived, 404 |
| DELETE | /api/organizations/:orgId/threads/:threadId | Yes | Author,Mod,Admin | Soft-delete thread | — | 204 | 401, 403, 404 |
| PUT | /api/organizations/:orgId/threads/:threadId/state | Yes | Mod,Admin | Update thread state flags | `{isPinned?, isFeatured?, isLocked?, isArchived?}` | 200 `{thread}` | 400 pinned limit, 401, 403, 404 |

### Replies

| Method | Path | Auth | Role | Description | Request Body | Success Response | Error Responses |
|--------|------|------|------|-------------|-------------|-----------------|-----------------|
| POST | /api/organizations/:orgId/threads/:threadId/replies | Yes | User+ | Create reply | `{body, parentReplyId?}` | 201 `{reply}` | 400 depth exceeded, 401, 403 locked/banned/muted, 404 thread |
| GET | /api/organizations/:orgId/threads/:threadId/replies | Yes | Any | List replies (paginated, nested) | `?page,limit` | 200 `{data:replies[],total,page,limit}` | 401, 404 |
| PUT | /api/organizations/:orgId/replies/:replyId | Yes | Author,Mod,Admin | Update reply | `{body}` | 200 `{reply}` | 400, 401, 403 not owner/archived, 404 |
| DELETE | /api/organizations/:orgId/replies/:replyId | Yes | Author,Mod,Admin | Soft-delete reply | — | 204 | 401, 403, 404 |

### Tags

| Method | Path | Auth | Role | Description | Request Body | Success Response | Error Responses |
|--------|------|------|------|-------------|-------------|-----------------|-----------------|
| POST | /api/organizations/:orgId/tags | Yes | Admin,Mod | Create tag | `{name, slug, category?}` | 201 `{tag}` | 400, 401, 403, 409 slug duplicate |
| GET | /api/organizations/:orgId/tags | Yes | Any | List tags | `?category` | 200 `{data:tags[]}` | 401 |
| PUT | /api/organizations/:orgId/tags/:tagId | Yes | Admin,Mod | Update tag | `{name?, slug?, category?}` | 200 `{tag}` | 400, 401, 403, 404, 409 |
| DELETE | /api/organizations/:orgId/tags/:tagId | Yes | Admin | Delete tag | — | 204 | 401, 403, 404 |

### Moderation (Bulk & Recycle Bin)

| Method | Path | Auth | Role | Description | Request Body | Success Response | Error Responses |
|--------|------|------|------|-------------|-------------|-----------------|-----------------|
| POST | /api/organizations/:orgId/moderation/bulk-action | Yes | Mod,Admin | Bulk content action | `{action, resourceType, resourceIds[]}` | 200 `{processed:number, failed:number, errors?:[]}` | 400, 401, 403 |
| GET | /api/organizations/:orgId/recycle-bin | Yes | Mod,Admin | List recycled items | `?resourceType,page,limit` | 200 `{data:items[],total,page,limit}` | 401, 403 |
| POST | /api/organizations/:orgId/recycle-bin/:itemType/:itemId/restore | Yes | Mod,Admin | Restore recycled item | — | 200 `{item}` | 401, 403, 404 |
| DELETE | /api/organizations/:orgId/recycle-bin/:itemType/:itemId | Yes | Admin | Permanently delete | — | 204 | 401, 403, 404 |

### Thread Reports

| Method | Path | Auth | Role | Description | Request Body | Success Response | Error Responses |
|--------|------|------|------|-------------|-------------|-----------------|-----------------|
| POST | /api/organizations/:orgId/threads/:threadId/reports | Yes | User+ | Report a thread | `{reason}` | 201 `{report}` | 400, 401, 404 |
| GET | /api/organizations/:orgId/reports | Yes | Mod,Admin | List reports | `?status,page,limit` | 200 `{data:reports[],total,page,limit}` | 401, 403 |
| PUT | /api/organizations/:orgId/reports/:reportId | Yes | Mod,Admin | Update report status | `{status}` | 200 `{report}` | 400, 401, 403, 404 |

### Announcements

| Method | Path | Auth | Role | Description | Request Body | Success Response | Error Responses |
|--------|------|------|------|-------------|-------------|-----------------|-----------------|
| POST | /api/organizations/:orgId/announcements | Yes | Admin | Create announcement | `{title, body, displayOrder, startDate, endDate}` | 201 `{announcement}` | 400, 401, 403 |
| GET | /api/organizations/:orgId/announcements | Yes | Any | List announcements | `?includeExpired,page,limit` | 200 `{data:announcements[]}` | 401 |
| GET | /api/organizations/:orgId/announcements/:id | Yes | Any | Get announcement | — | 200 `{announcement}` | 401, 404 |
| PUT | /api/organizations/:orgId/announcements/:id | Yes | Admin | Update announcement | `{title?, body?, displayOrder?, startDate?, endDate?, isPublished?}` | 200 `{announcement}` | 400, 401, 403, 404 |
| DELETE | /api/organizations/:orgId/announcements/:id | Yes | Admin | Delete announcement | — | 204 | 401, 403, 404 |

### Carousel

| Method | Path | Auth | Role | Description | Request Body | Success Response | Error Responses |
|--------|------|------|------|-------------|-------------|-----------------|-----------------|
| POST | /api/organizations/:orgId/carousel | Yes | Admin | Create carousel item | `{title, imageUrl?, linkUrl?, displayOrder, startDate, endDate}` | 201 `{item}` | 400, 401, 403 |
| GET | /api/organizations/:orgId/carousel | Yes | Any | List active carousel items | `?includeExpired` | 200 `{data:items[]}` | 401 |
| PUT | /api/organizations/:orgId/carousel/:id | Yes | Admin | Update carousel item | `{title?, imageUrl?, linkUrl?, displayOrder?, startDate?, endDate?, isActive?}` | 200 `{item}` | 400, 401, 403, 404 |
| DELETE | /api/organizations/:orgId/carousel/:id | Yes | Admin | Delete carousel item | — | 204 | 401, 403, 404 |

### Venues & Bookings

| Method | Path | Auth | Role | Description | Request Body | Success Response | Error Responses |
|--------|------|------|------|-------------|-------------|-----------------|-----------------|
| POST | /api/organizations/:orgId/venues | Yes | Admin | Create venue | `{name, description?, capacity?}` | 201 `{venue}` | 400, 401, 403 |
| GET | /api/organizations/:orgId/venues | Yes | Any | List venues | — | 200 `{data:venues[]}` | 401 |
| GET | /api/organizations/:orgId/venues/:venueId | Yes | Any | Get venue detail | — | 200 `{venue}` | 401, 404 |
| PUT | /api/organizations/:orgId/venues/:venueId | Yes | Admin | Update venue | `{name?, description?, capacity?, isActive?}` | 200 `{venue}` | 400, 401, 403, 404 |
| DELETE | /api/organizations/:orgId/venues/:venueId | Yes | Admin | Delete venue | — | 204 | 401, 403, 404 |
| POST | /api/organizations/:orgId/venues/:venueId/bookings | Yes | User+ | Create booking | `{title, startTime, endTime}` | 201 `{booking}` | 400, 401, 409 conflict |
| GET | /api/organizations/:orgId/venues/:venueId/bookings | Yes | Any | List bookings for venue | `?startDate,endDate,status` | 200 `{data:bookings[]}` | 401, 404 |
| PUT | /api/organizations/:orgId/bookings/:bookingId | Yes | Author,Admin | Update booking | `{title?, startTime?, endTime?}` | 200 `{booking}` | 400, 401, 403, 404, 409 conflict |
| DELETE | /api/organizations/:orgId/bookings/:bookingId | Yes | Author,Admin | Cancel booking | — | 204 | 401, 403, 404 |

### Notifications & Subscriptions

| Method | Path | Auth | Role | Description | Request Body | Success Response | Error Responses |
|--------|------|------|------|-------------|-------------|-----------------|-----------------|
| GET | /api/organizations/:orgId/notifications | Yes | Any | List my notifications | `?status,page,limit` | 200 `{data:notifications[],total,unreadCount}` | 401 |
| PUT | /api/organizations/:orgId/notifications/:id/read | Yes | Any | Mark notification read | — | 200 `{notification}` | 401, 404 |
| PUT | /api/organizations/:orgId/notifications/read-all | Yes | Any | Mark all notifications read | — | 200 `{updatedCount}` | 401 |
| GET | /api/organizations/:orgId/subscriptions | Yes | Any | List my subscriptions | — | 200 `{data:subscriptions[]}` | 401 |
| PUT | /api/organizations/:orgId/subscriptions | Yes | Any | Update a subscription | `{category, isSubscribed}` | 200 `{subscription}` | 400, 401 |

### Audit & Analytics

| Method | Path | Auth | Role | Description | Request Body | Success Response | Error Responses |
|--------|------|------|------|-------------|-------------|-----------------|-----------------|
| GET | /api/organizations/:orgId/audit-logs | Yes | Admin,Analyst | List audit logs (paginated) | `?action,actorId,resourceType,startDate,endDate,page,limit` | 200 `{data:logs[],total,page,limit}` | 401, 403 |
| GET | /api/organizations/:orgId/analytics/funnel | Yes | Admin,Analyst | Funnel metrics | `?startDate,endDate,granularity` | 200 `{metrics:{views,registrations,posts,engagements,periods:[]}}` | 401, 403 |
| GET | /api/organizations/:orgId/anomalies | Yes | Admin,Mod,Analyst | List anomaly flags | `?status,severity,page,limit` | 200 `{data:anomalies[],total,page,limit}` | 401, 403 |
| PUT | /api/organizations/:orgId/anomalies/:id | Yes | Admin,Mod | Update anomaly status | `{status}` | 200 `{anomaly}` | 400, 401, 403, 404 |

### Feature Flags

| Method | Path | Auth | Role | Description | Request Body | Success Response | Error Responses |
|--------|------|------|------|-------------|-------------|-----------------|-----------------|
| POST | /api/organizations/:orgId/feature-flags | Yes | Admin | Create feature flag | `{key, value, description?}` | 201 `{flag}` | 400, 401, 403, 409 key exists |
| GET | /api/organizations/:orgId/feature-flags | Yes | Admin | List feature flags | — | 200 `{data:flags[]}` | 401, 403 |
| PUT | /api/organizations/:orgId/feature-flags/:flagId | Yes | Admin | Update feature flag | `{value?, description?}` | 200 `{flag}` | 400, 401, 403, 404 |
| DELETE | /api/organizations/:orgId/feature-flags/:flagId | Yes | Admin | Delete feature flag | — | 204 | 401, 403, 404 |

---

## Validation Rules

| Field | Location | Rules |
|-------|----------|-------|
| username | register, login | required, 3–100 chars, alphanumeric + underscore only, trimmed |
| password | register, login, change password | required, min 12 chars, max 128 chars |
| newPassword | change password | required, min 12 chars, max 128 chars, must differ from currentPassword |
| organizationId | login, all org-scoped routes (path param) | required, valid UUID format |
| name | org, section, subsection, venue | required, 1–255 chars, trimmed |
| slug | org create, tag create/update | required, 1–100 chars, lowercase alphanumeric + hyphens only, trimmed |
| description | section, subsection, venue, announcement | optional, max 5000 chars |
| displayOrder | section, subsection, announcement, carousel | optional, integer ≥ 0 |
| title | thread, announcement, carousel, booking | required, 1–300 chars, trimmed |
| body | thread, reply, announcement | required, 1–50000 chars |
| tagIds | thread create/update | optional, array of valid UUIDs, max 10 items |
| parentReplyId | reply create | optional, valid UUID, must exist in same thread, parent depth must be < 3 |
| durationHours | mute user | required, integer, min 24, max 720 |
| reason | ban, mute, report | optional for ban/mute (max 2000 chars), required for report (1–2000 chars) |
| role | user create, role update | required, one of: 'admin', 'moderator', 'analyst', 'user' |
| startDate / endDate | announcement, carousel | required, valid ISO 8601 datetime, endDate must be after startDate |
| startTime / endTime | venue booking | required, valid ISO 8601 datetime, endTime must be after startTime, must not overlap existing confirmed bookings for same venue |
| category | tag (optional, max 100 chars), subscription update (required, max 100 chars) |
| isSubscribed | subscription update | required, boolean; ignored for 'security' category (always true) |
| action | bulk action | required, one of: 'delete', 'lock', 'archive', 'move' |
| resourceType | bulk action, recycle bin | required, one of: 'thread', 'reply' |
| resourceIds | bulk action | required, non-empty array of UUIDs, max 100 items per request |
| key | feature flag | required, 1–100 chars, alphanumeric + underscore + dot |
| value | feature flag | required, valid JSON object |
| page | all paginated endpoints | optional, integer ≥ 1, default 1 |
| limit | all paginated endpoints | optional, integer 1–100, default 20 |
| sort | thread list | optional, one of: 'latest', 'oldest', 'mostReplies', 'mostViews', default 'latest' |
| search | thread list, user list | optional, max 200 chars |
| status | report update | required, one of: 'reviewed', 'dismissed' |
| status | anomaly update | required, one of: 'acknowledged', 'resolved', 'dismissed' |
| granularity | funnel metrics | optional, one of: 'day', 'week', 'month', default 'day' |
| capacity | venue | optional, integer ≥ 1 |
| email | user create | optional, valid email format, max 255 chars |
| imageUrl | carousel item | optional, max 1000 chars, valid URL format |
| linkUrl | carousel item | optional, max 1000 chars, valid URL format |
| isActive | venue, carousel update | optional, boolean |
| isPublished | announcement update | optional, boolean |
| includeExpired | announcements, carousel list | optional, boolean, default false |

---

## Error Handling Strategy

- **API layer**: All route handlers wrapped in an async error-catching middleware. Unhandled errors return `{error: {code: "INTERNAL_ERROR", message: "An unexpected error occurred"}}` with 500 status. Stack traces logged internally but never exposed to client.
- **Validation**: Zod schemas validate all request bodies, query params, and path params via reusable validation middleware. Failures return 400 with `{error: {code: "VALIDATION_ERROR", message: "Validation failed", details: [{field: "title", message: "Required, max 300 chars"}]}}`.
- **Authentication**: Missing/invalid/expired token → 401 `{error: {code: "UNAUTHORIZED", message: "Authentication required"}}`. Account locked → 423 `{error: {code: "ACCOUNT_LOCKED", message: "Account locked due to too many failed attempts", lockedUntil: "ISO timestamp"}}`.
- **Authorization**: Wrong organization → 403. Insufficient role → 403 `{error: {code: "FORBIDDEN", message: "Insufficient permissions"}}`. Not resource owner (for regular users) → 403.
- **Business rules**: Locked thread → 403 `{code: "THREAD_LOCKED"}`. Archived content → 403 `{code: "THREAD_ARCHIVED"}`. Pinned limit → 400 `{code: "PINNED_LIMIT_REACHED", message: "Maximum 3 pinned threads per section"}`. Booking conflict → 409 `{code: "BOOKING_CONFLICT"}`. Banned user → 403 `{code: "USER_BANNED"}`. Muted user → 403 `{code: "USER_MUTED", mutedUntil}`. Max nesting depth → 400 `{code: "MAX_NESTING_DEPTH"}`.
- **Database**: Unique constraint violations → 409 with descriptive message. Foreign key violations → 400 or 404. Connection errors → 503 `{code: "SERVICE_UNAVAILABLE"}`.
- **Rate limiting**: 429 `{error: {code: "RATE_LIMITED", message: "Too many requests", retryAfter: seconds}}`.
- **Not found**: Any missing resource → 404 `{error: {code: "NOT_FOUND", message: "Resource not found"}}`. Never leak existence of resources in other organizations.

---

## Logging Strategy

- **Library**: Pino with `pino-pretty` for development
- **Format**: Structured JSON — `{timestamp, level, msg, correlationId, userId?, organizationId?, method?, path?, statusCode?, durationMs?, error?}`
- **Correlation ID**: Generated per request via `crypto.randomUUID()`, attached to all log entries for that request, returned in `X-Correlation-ID` response header, propagated to async notification/job processing
- **Levels**:
  - `info`: request start/end (method + path + status + duration), successful logins, configuration changes
  - `warn`: failed login attempts, rate limit hits, approaching anomaly thresholds, business rule violations
  - `error`: unhandled exceptions, database connection failures, job failures
- **NEVER log**: passwords, password_hash, JWT tokens, email_encrypted values, full request bodies containing sensitive fields
- **DO log**: request method + path + status + duration, auth failures (with username masked as `u***e`), validation failure field names (not values), all moderation actions, all configuration changes, anomaly flag triggers
- **PII masking**: Utility function that replaces usernames/emails in log strings with masked versions before writing
- **Alerting thresholds** (logged as `warn` with `alert: true` field):
  - Error rate > 10 errors/minute
  - p95 latency > 500ms for any 5-minute window
  - Anomaly flag created
  - Account lockout triggered

---

## Implied Requirements

- Health check endpoint at `GET /api/health` returning `{status: "ok"}`
- Error handling on ALL endpoints with proper HTTP status codes (400, 401, 403, 404, 409, 423, 429, 500, 503)
- Input validation on ALL API inputs via Zod middleware
- Auth middleware on ALL protected routes
- Organization-scoped authorization: users can ONLY access resources within their organization
- Role-based authorization checked on every protected endpoint
- Object-level authorization: regular users can only modify their own threads/replies/bookings
- Structured JSON logging with Pino and correlation IDs
- Docker support with Prisma auto-migration on startup
- Integration tests in `run_tests.sh` covering all major flows
- Unit tests for business logic (state transitions, anomaly detection, booking conflict validation, pinned limit)
- README with accurate startup and test instructions
- All env vars with defaults in `docker-compose.yml`
- Lightweight Docker image (`node:20-alpine` base)
- Recycle bin auto-purge scheduled job (daily, removes items with `deleted_at` > 30 days ago)
- Notification retry scheduled job (periodic, handles exponential backoff: 1min, 4min, 16min)
- Anomaly detection scheduled job (every 5 minutes, checks rolling time windows)
- Mute expiry check (periodic, auto-clears `is_muted` when `muted_until` has passed)
- Token blacklist cleanup (periodic, removes entries where `expires_at` has passed)
- Nightly backup script with 14-day retention and MySQL binlog configuration
- Password hashing with bcrypt (12 salt rounds)
- AES-256-GCM encryption for email field at rest
- Pagination on all list endpoints with consistent response shape `{data, total, page, limit}`
- Seed script to create a default organization and admin user

---

## Scope Boundary

Do NOT build these:

- No frontend / UI — this is a backend-only API service
- No email verification — accounts created by admins only
- No password reset via email — admin resets or user self-change only
- No OAuth / social login — username + password only
- No SMS, email, WeChat, or any external notification delivery — in-app only
- No external analytics or third-party integrations
- No file upload / image hosting — carousel `imageUrl` is a reference string only
- No real-time WebSocket features — REST API with standard polling
- No full-text search engine (Elasticsearch, etc.) — MySQL LIKE/FULLTEXT only
- No multi-region / replication — single host deployment
- No horizontal scaling — single container design
- No email collection for verification purposes — display-only if collected, encrypted at rest
- No public (unauthenticated) forum browsing — all content routes require auth
- No user self-registration — admin creates accounts
- No third-party rate limiting backends (Redis) — in-memory store only
- No external alerting services (PagerDuty, Slack webhooks) — log-based only

---

## Project Structure

```
repo/
├── src/
│   ├── config/
│   │   ├── database.ts           # Prisma client singleton
│   │   ├── env.ts                # Environment variable validation (Zod)
│   │   ├── logger.ts             # Pino logger setup
│   │   └── encryption.ts         # AES-256-GCM encrypt/decrypt helpers
│   ├── middleware/
│   │   ├── auth.ts               # JWT verification, token blacklist check
│   │   ├── rbac.ts               # Role-based access control (requireRole)
│   │   ├── orgScope.ts           # Organization scoping + ownership checks
│   │   ├── rateLimiter.ts        # Rate limiting (separate read/write limits)
│   │   ├── errorHandler.ts       # Global error handling middleware
│   │   ├── correlationId.ts      # Attach/propagate correlation ID
│   │   ├── validate.ts           # Zod schema validation middleware factory
│   │   └── checkBanMute.ts       # Block writes from banned/muted users
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.service.ts   # Login, logout, lockout logic
│   │   │   └── auth.schema.ts    # Zod schemas for auth endpoints
│   │   ├── organizations/
│   │   │   ├── organizations.routes.ts
│   │   │   ├── organizations.service.ts
│   │   │   └── organizations.schema.ts
│   │   ├── users/
│   │   │   ├── users.routes.ts
│   │   │   ├── users.service.ts  # CRUD, ban, mute, role update
│   │   │   └── users.schema.ts
│   │   ├── sections/
│   │   │   ├── sections.routes.ts
│   │   │   ├── sections.service.ts
│   │   │   └── sections.schema.ts
│   │   ├── threads/
│   │   │   ├── threads.routes.ts
│   │   │   ├── threads.service.ts  # CRUD, state transitions, pinned limit
│   │   │   └── threads.schema.ts
│   │   ├── replies/
│   │   │   ├── replies.routes.ts
│   │   │   ├── replies.service.ts  # CRUD, depth enforcement
│   │   │   └── replies.schema.ts
│   │   ├── tags/
│   │   │   ├── tags.routes.ts
│   │   │   ├── tags.service.ts
│   │   │   └── tags.schema.ts
│   │   ├── moderation/
│   │   │   ├── moderation.routes.ts
│   │   │   ├── moderation.service.ts  # Bulk actions, recycle bin
│   │   │   └── moderation.schema.ts
│   │   ├── reports/
│   │   │   ├── reports.routes.ts
│   │   │   ├── reports.service.ts
│   │   │   └── reports.schema.ts
│   │   ├── announcements/
│   │   │   ├── announcements.routes.ts
│   │   │   ├── announcements.service.ts
│   │   │   └── announcements.schema.ts
│   │   ├── carousel/
│   │   │   ├── carousel.routes.ts
│   │   │   ├── carousel.service.ts
│   │   │   └── carousel.schema.ts
│   │   ├── venues/
│   │   │   ├── venues.routes.ts
│   │   │   ├── venues.service.ts   # CRUD, booking conflict validation
│   │   │   └── venues.schema.ts
│   │   ├── notifications/
│   │   │   ├── notifications.routes.ts
│   │   │   ├── notifications.service.ts  # CRUD, delivery, retry logic
│   │   │   └── notifications.schema.ts
│   │   ├── subscriptions/
│   │   │   ├── subscriptions.routes.ts
│   │   │   ├── subscriptions.service.ts
│   │   │   └── subscriptions.schema.ts
│   │   ├── audit/
│   │   │   ├── audit.routes.ts
│   │   │   ├── audit.service.ts   # Append-only log writer + query
│   │   │   └── audit.schema.ts
│   │   ├── analytics/
│   │   │   ├── analytics.routes.ts
│   │   │   └── analytics.service.ts  # Funnel metric aggregation
│   │   ├── anomalies/
│   │   │   ├── anomalies.routes.ts
│   │   │   ├── anomalies.service.ts  # Detection rules + flag management
│   │   │   └── anomalies.schema.ts
│   │   └── feature-flags/
│   │       ├── feature-flags.routes.ts
│   │       ├── feature-flags.service.ts
│   │       └── feature-flags.schema.ts
│   ├── jobs/
│   │   ├── scheduler.ts             # node-cron job registry
│   │   ├── recycleBinPurge.ts       # Purge items with deleted_at > 30 days
│   │   ├── notificationRetry.ts     # Retry failed notifications (exponential backoff)
│   │   ├── notificationScheduled.ts  # Deliver scheduled notifications
│   │   ├── anomalyDetection.ts      # Run anomaly detection rules
│   │   ├── muteExpiry.ts            # Clear expired mutes
│   │   ├── tokenCleanup.ts          # Remove expired blacklisted tokens
│   │   └── backup.ts               # Nightly mysqldump wrapper
│   ├── utils/
│   │   ├── pagination.ts            # Pagination query helper
│   │   ├── masks.ts                 # PII masking for log output
│   │   └── errors.ts               # Custom error classes (AppError, ValidationError, etc.)
│   └── app.ts                       # Express app setup, middleware registration, route mounting
├── prisma/
│   ├── schema.prisma                # Full Prisma schema with all models
│   ├── seed.ts                      # Default org + admin user seeding
│   └── migrations/                  # Generated by prisma migrate
├── scripts/
│   ├── backup.sh                    # mysqldump with 14-day retention
│   └── entrypoint.sh               # Docker entrypoint: wait for DB, migrate, seed, start
├── tests/
│   ├── setup.ts                     # Test database setup/teardown, global test config
│   ├── helpers.ts                   # Auth token helpers, factory functions for test data
│   └── integration/
│       ├── health.test.ts
│       ├── auth.test.ts
│       ├── users.test.ts
│       ├── sections.test.ts
│       ├── threads.test.ts
│       ├── replies.test.ts
│       ├── tags.test.ts
│       ├── moderation.test.ts
│       ├── reports.test.ts
│       ├── announcements.test.ts
│       ├── carousel.test.ts
│       ├── venues.test.ts
│       ├── notifications.test.ts
│       ├── subscriptions.test.ts
│       ├── audit.test.ts
│       ├── analytics.test.ts
│       ├── anomalies.test.ts
│       └── feature-flags.test.ts
├── Dockerfile
├── .dockerignore
├── docker-compose.yml
├── tsconfig.json
├── package.json
├── jest.config.ts
├── run_tests.sh
└── README.md
```

---

## run_tests.sh Coverage Plan

### Health
1. `GET /api/health` → 200 with `{status: "ok"}`

### Authentication
2. `POST /api/auth/login` with valid credentials → 200 + token returned
3. `POST /api/auth/login` with wrong password → 401
4. `POST /api/auth/login` with missing fields → 400
5. `POST /api/auth/login` with password < 12 chars during registration context → 400
6. 5 failed logins within 15 minutes → 423 account locked
7. `GET /api/auth/me` with valid token → 200 + user object
8. `GET /api/auth/me` without token → 401
9. `PUT /api/auth/password` with valid current + new password (≥12 chars) → 200
10. `PUT /api/auth/password` with new password < 12 chars → 400
11. `POST /api/auth/logout` → 200, subsequent request with same token → 401

### User Management
12. `POST /api/organizations/:orgId/users` with valid data → 201
13. `POST /api/organizations/:orgId/users` with duplicate username in same org → 409
14. `POST /api/organizations/:orgId/users` with password < 12 chars → 400
15. `GET /api/organizations/:orgId/users` as admin → 200 + paginated list
16. `GET /api/organizations/:orgId/users` as regular user → 403
17. `PUT /api/organizations/:orgId/users/:id/role` as admin → 200 + role updated
18. `PUT /api/organizations/:orgId/users/:id/role` as regular user → 403

### Ban/Mute
19. `POST /api/organizations/:orgId/users/:id/ban` as moderator → 200
20. Banned user attempts to create thread → 403 `USER_BANNED`
21. `POST /api/organizations/:orgId/users/:id/unban` → 200, user can post again
22. `POST /api/organizations/:orgId/users/:id/mute` with `{durationHours: 48}` → 200
23. Muted user attempts to create reply → 403 `USER_MUTED`
24. `POST /api/organizations/:orgId/users/:id/mute` with durationHours < 24 → 400
25. `POST /api/organizations/:orgId/users/:id/mute` with durationHours > 720 → 400
26. `POST /api/organizations/:orgId/users/:id/unmute` → 200, user can post again

### Forum Sections & Subsections
27. `POST /api/organizations/:orgId/sections` as admin → 201
28. `POST /api/organizations/:orgId/sections` as regular user → 403
29. `GET /api/organizations/:orgId/sections` → 200 + list with subsections
30. `PUT /api/organizations/:orgId/sections/:id` → 200
31. `DELETE /api/organizations/:orgId/sections/:id` → 204
32. `POST /api/organizations/:orgId/sections/:id/subsections` → 201
33. `GET /api/organizations/:orgId/sections/:id/subsections` → 200

### Threads
34. `POST /api/organizations/:orgId/threads` with valid data + tags → 201
35. `POST /api/organizations/:orgId/threads` missing title → 400
36. `GET /api/organizations/:orgId/threads?subsectionId=X` → 200 + paginated list
37. `GET /api/organizations/:orgId/threads/:id` → 200 + thread detail
38. `GET /api/organizations/:orgId/threads/nonexistent-uuid` → 404
39. `PUT /api/organizations/:orgId/threads/:id` as author → 200
40. `PUT /api/organizations/:orgId/threads/:id` as non-owner regular user → 403
41. `DELETE /api/organizations/:orgId/threads/:id` as author → 204

### Thread State Transitions
42. Pin thread via `PUT .../threads/:id/state {isPinned: true}` as moderator → 200
43. Pin 3 threads in same section → all succeed
44. Attempt to pin 4th thread in same section → 400 `PINNED_LIMIT_REACHED`
45. Lock thread → 200
46. Attempt to reply to locked thread → 403 `THREAD_LOCKED`
47. Archive thread → 200
48. Attempt to edit archived thread body → 403 `THREAD_ARCHIVED`
49. Attempt to edit reply in archived thread → 403 `THREAD_ARCHIVED`

### Replies
50. `POST .../threads/:id/replies` with body → 201
51. Create reply to reply (depth 2) → 201
52. Create reply to depth-2 reply (depth 3) → 201
53. Attempt reply to depth-3 reply (would be depth 4) → 400 `MAX_NESTING_DEPTH`
54. `PUT .../replies/:id` as author → 200
55. `DELETE .../replies/:id` → 204

### Tags
56. `POST /api/organizations/:orgId/tags` with name + slug → 201
57. `POST /api/organizations/:orgId/tags` with duplicate slug in same org → 409
58. `GET /api/organizations/:orgId/tags` → 200 + list
59. `PUT /api/organizations/:orgId/tags/:id` → 200
60. `DELETE /api/organizations/:orgId/tags/:id` → 204
61. Create thread with tagIds → verify tags attached in GET response

### Moderation & Recycle Bin
62. Bulk delete 3 threads → 200 `{processed: 3}`
63. `GET .../recycle-bin` → 200 + deleted threads listed
64. Restore thread from recycle bin → 200
65. Verify restored thread accessible via `GET .../threads/:id` → 200
66. Permanently delete item from recycle bin (admin only) → 204

### Thread Reports
67. `POST .../threads/:id/reports` with reason → 201
68. `GET .../reports` as moderator → 200 + list
69. `PUT .../reports/:id {status: "reviewed"}` → 200

### Announcements
70. `POST .../announcements` with valid dates → 201
71. `GET .../announcements` → 200 + only active announcements
72. `GET .../announcements?includeExpired=true` → 200 + includes expired
73. `PUT .../announcements/:id` → 200
74. `DELETE .../announcements/:id` → 204

### Carousel
75. `POST .../carousel` with valid data → 201
76. `GET .../carousel` → 200

### Venues & Bookings
77. `POST .../venues` → 201
78. `GET .../venues` → 200
79. `POST .../venues/:id/bookings` with valid non-overlapping time → 201
80. `POST .../venues/:id/bookings` with overlapping time for same venue → 409
81. `GET .../venues/:id/bookings` → 200 + bookings listed
82. Cancel booking via `DELETE .../bookings/:id` → 204

### Notifications & Subscriptions
83. `GET .../notifications` → 200 + list with unreadCount
84. `PUT .../notifications/:id/read` → 200 + read_at set
85. `PUT .../notifications/read-all` → 200
86. `GET .../subscriptions` → 200
87. `PUT .../subscriptions` with `{category, isSubscribed: false}` → 200

### Audit & Analytics
88. `GET .../audit-logs` as admin → 200 + audit entries exist (from prior actions)
89. `GET .../audit-logs` as regular user → 403
90. `GET .../analytics/funnel` as analyst → 200 + metrics object
91. `GET .../anomalies` → 200

### Feature Flags
92. `POST .../feature-flags` with `{key, value}` → 201
93. `GET .../feature-flags` → 200 + list
94. `PUT .../feature-flags/:id` → 200
95. `DELETE .../feature-flags/:id` → 204
96. Verify feature flag change created audit log entry

### Cross-Organization Isolation
97. Create user in org B, attempt to access thread in org A → 403
98. Create user in org B, attempt to list users in org A → 403

### Rate Limiting
99. Exceed write rate limit (120 writes/min) → 429 with retryAfter
