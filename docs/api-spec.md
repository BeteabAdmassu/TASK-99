# API Specification

## Authentication

All protected endpoints require a `Authorization: Bearer <token>` header. Tokens are JWTs issued by `POST /api/auth/login` with a 24-hour expiry. Each token includes a `jti` claim for blacklisting on logout.

### Rate Limiting
- **Write operations** (POST, PUT, DELETE): 120 requests/minute per user
- **Read operations** (GET): 600 requests/minute per user
- Exceeding limits returns 429 with `Retry-After` header

### Correlation ID
Every request receives an `X-Correlation-ID` header in the response. Include it in bug reports for log tracing.

---

## Error Response Format

All errors follow this structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": [
      {"field": "title", "message": "Required, max 300 characters"}
    ]
  }
}
```

### Standard Error Codes

| HTTP Status | Code | When |
|-------------|------|------|
| 400 | VALIDATION_ERROR | Invalid input, missing required fields, constraint violations |
| 400 | PINNED_LIMIT_REACHED | Attempting to pin more than 3 threads per section |
| 400 | MAX_NESTING_DEPTH | Attempting to nest reply beyond depth 3 |
| 401 | UNAUTHORIZED | Missing, invalid, or expired token |
| 403 | FORBIDDEN | Insufficient role or not resource owner |
| 403 | THREAD_LOCKED | Attempting to reply to a locked thread |
| 403 | THREAD_ARCHIVED | Attempting to edit content in an archived thread |
| 403 | USER_BANNED | Banned user attempting a write operation |
| 403 | USER_MUTED | Muted user attempting to create content |
| 404 | NOT_FOUND | Resource does not exist (or not in user's org) |
| 409 | CONFLICT | Duplicate unique value (username, slug, flag key) |
| 409 | BOOKING_CONFLICT | Venue booking time overlaps with existing booking |
| 423 | ACCOUNT_LOCKED | Too many failed login attempts |
| 429 | RATE_LIMITED | Rate limit exceeded |
| 500 | INTERNAL_ERROR | Unexpected server error |
| 503 | SERVICE_UNAVAILABLE | Database connection failure |

---

## Endpoints

### Health

| Method | Path | Auth | Description | Request Body | Response | Errors |
|--------|------|------|-------------|-------------|----------|--------|
| GET | /api/health | No | Health check | — | 200 `{status:"ok",timestamp,version}` | — |

### Authentication

| Method | Path | Auth | Description | Request Body | Response | Errors |
|--------|------|------|-------------|-------------|----------|--------|
| POST | /api/auth/login | No | Login | `{username:string, password:string, organizationId:uuid}` | 200 `{token:string, user:{id,username,role,organizationId}}` | 400, 401, 423 |
| POST | /api/auth/logout | Yes | Invalidate token | — | 200 `{message:string}` | 401 |
| GET | /api/auth/me | Yes | Current user profile | — | 200 `{user:{id,username,role,organizationId,isBanned,isMuted,mutedUntil,createdAt}}` | 401 |
| PUT | /api/auth/password | Yes | Change own password | `{currentPassword:string, newPassword:string}` | 200 `{message:string}` | 400, 401 |

### Organizations

| Method | Path | Auth | Description | Request Body | Response | Errors |
|--------|------|------|-------------|-------------|----------|--------|
| POST | /api/organizations | Yes (Admin) | Create org | `{name:string, slug:string, settings?:object}` | 201 `{organization}` | 400, 409 |
| GET | /api/organizations/:orgId | Yes | Get org | — | 200 `{organization}` | 401, 403, 404 |
| PUT | /api/organizations/:orgId | Yes (Admin) | Update org | `{name?:string, settings?:object}` | 200 `{organization}` | 400, 401, 403, 404 |

### Users

| Method | Path | Auth | Description | Request Body | Response | Errors |
|--------|------|------|-------------|-------------|----------|--------|
| POST | /api/organizations/:orgId/users | Yes (Admin) | Create user | `{username:string, password:string, role?:enum, email?:string}` | 201 `{user}` | 400, 409 |
| GET | /api/organizations/:orgId/users | Yes (Admin/Mod/Analyst) | List users | `?page,limit,role,search` | 200 `{data:[user],total,page,limit}` | 401, 403 |
| GET | /api/organizations/:orgId/users/:userId | Yes (Admin/Mod/Analyst) | Get user | — | 200 `{user}` | 401, 403, 404 |
| PUT | /api/organizations/:orgId/users/:userId/role | Yes (Admin) | Update role | `{role:enum}` | 200 `{user}` | 400, 401, 403, 404 |
| POST | /api/organizations/:orgId/users/:userId/ban | Yes (Admin/Mod) | Ban user | `{reason?:string}` | 200 `{user}` | 401, 403, 404 |
| POST | /api/organizations/:orgId/users/:userId/unban | Yes (Admin/Mod) | Unban user | — | 200 `{user}` | 401, 403, 404 |
| POST | /api/organizations/:orgId/users/:userId/mute | Yes (Admin/Mod) | Mute user | `{durationHours:int, reason?:string}` | 200 `{user}` | 400, 401, 403, 404 |
| POST | /api/organizations/:orgId/users/:userId/unmute | Yes (Admin/Mod) | Unmute user | — | 200 `{user}` | 401, 403, 404 |

### Forum Sections

| Method | Path | Auth | Description | Request Body | Response | Errors |
|--------|------|------|-------------|-------------|----------|--------|
| POST | /api/organizations/:orgId/sections | Yes (Admin) | Create section | `{name:string, description?:string, displayOrder?:int}` | 201 `{section}` | 400, 401, 403 |
| GET | /api/organizations/:orgId/sections | Yes | List sections | `?includeSubsections` | 200 `{data:[section]}` | 401 |
| GET | /api/organizations/:orgId/sections/:sectionId | Yes | Get section | — | 200 `{section}` | 401, 404 |
| PUT | /api/organizations/:orgId/sections/:sectionId | Yes (Admin) | Update section | `{name?:string, description?:string, displayOrder?:int}` | 200 `{section}` | 400, 401, 403, 404 |
| DELETE | /api/organizations/:orgId/sections/:sectionId | Yes (Admin) | Delete section | — | 204 | 401, 403, 404 |

### Forum Subsections

| Method | Path | Auth | Description | Request Body | Response | Errors |
|--------|------|------|-------------|-------------|----------|--------|
| POST | /api/organizations/:orgId/sections/:sectionId/subsections | Yes (Admin) | Create subsection | `{name:string, description?:string, displayOrder?:int}` | 201 `{subsection}` | 400, 401, 403, 404 |
| GET | /api/organizations/:orgId/sections/:sectionId/subsections | Yes | List subsections | — | 200 `{data:[subsection]}` | 401, 404 |
| PUT | /api/organizations/:orgId/subsections/:subId | Yes (Admin) | Update subsection | `{name?:string, description?:string, displayOrder?:int}` | 200 `{subsection}` | 400, 401, 403, 404 |
| DELETE | /api/organizations/:orgId/subsections/:subId | Yes (Admin) | Delete subsection | — | 204 | 401, 403, 404 |

### Threads

| Method | Path | Auth | Description | Request Body | Response | Errors |
|--------|------|------|-------------|-------------|----------|--------|
| POST | /api/organizations/:orgId/threads | Yes (User+) | Create thread | `{subsectionId:uuid, title:string, body:string, tagIds?:uuid[]}` | 201 `{thread}` | 400, 401, 403 |
| GET | /api/organizations/:orgId/threads | Yes | List threads | `?subsectionId,tagId,search,page,limit,sort` | 200 `{data:[thread],total,page,limit}` | 401 |
| GET | /api/organizations/:orgId/threads/:threadId | Yes | Get thread | — | 200 `{thread}` | 401, 404 |
| PUT | /api/organizations/:orgId/threads/:threadId | Yes (Author/Mod/Admin) | Update thread | `{title?:string, body?:string, tagIds?:uuid[]}` | 200 `{thread}` | 400, 401, 403, 404 |
| DELETE | /api/organizations/:orgId/threads/:threadId | Yes (Author/Mod/Admin) | Soft-delete | — | 204 | 401, 403, 404 |
| PUT | /api/organizations/:orgId/threads/:threadId/state | Yes (Mod/Admin) | Update state | `{isPinned?:bool, isFeatured?:bool, isLocked?:bool, isArchived?:bool}` | 200 `{thread}` | 400, 401, 403, 404 |

### Replies

| Method | Path | Auth | Description | Request Body | Response | Errors |
|--------|------|------|-------------|-------------|----------|--------|
| POST | /api/organizations/:orgId/threads/:threadId/replies | Yes (User+) | Create reply | `{body:string, parentReplyId?:uuid}` | 201 `{reply}` | 400, 401, 403, 404 |
| GET | /api/organizations/:orgId/threads/:threadId/replies | Yes | List replies | `?page,limit` | 200 `{data:[reply],total,page,limit}` | 401, 404 |
| PUT | /api/organizations/:orgId/replies/:replyId | Yes (Author/Mod/Admin) | Update reply | `{body:string}` | 200 `{reply}` | 400, 401, 403, 404 |
| DELETE | /api/organizations/:orgId/replies/:replyId | Yes (Author/Mod/Admin) | Soft-delete | — | 204 | 401, 403, 404 |

### Tags

| Method | Path | Auth | Description | Request Body | Response | Errors |
|--------|------|------|-------------|-------------|----------|--------|
| POST | /api/organizations/:orgId/tags | Yes (Admin/Mod) | Create tag | `{name:string, slug:string, category?:string}` | 201 `{tag}` | 400, 401, 403, 409 |
| GET | /api/organizations/:orgId/tags | Yes | List tags | `?category` | 200 `{data:[tag]}` | 401 |
| PUT | /api/organizations/:orgId/tags/:tagId | Yes (Admin/Mod) | Update tag | `{name?:string, slug?:string, category?:string}` | 200 `{tag}` | 400, 401, 403, 404, 409 |
| DELETE | /api/organizations/:orgId/tags/:tagId | Yes (Admin) | Delete tag | — | 204 | 401, 403, 404 |

### Moderation

| Method | Path | Auth | Description | Request Body | Response | Errors |
|--------|------|------|-------------|-------------|----------|--------|
| POST | /api/organizations/:orgId/moderation/bulk-action | Yes (Mod/Admin) | Bulk action | `{action:enum, resourceType:enum, resourceIds:uuid[]}` | 200 `{processed:int, failed:int, errors?:[]}` | 400, 401, 403 |
| GET | /api/organizations/:orgId/recycle-bin | Yes (Mod/Admin) | List recycled | `?resourceType,page,limit` | 200 `{data:[item],total,page,limit}` | 401, 403 |
| POST | /api/organizations/:orgId/recycle-bin/:itemType/:itemId/restore | Yes (Mod/Admin) | Restore item | — | 200 `{item}` | 401, 403, 404 |
| DELETE | /api/organizations/:orgId/recycle-bin/:itemType/:itemId | Yes (Admin) | Permanent delete | — | 204 | 401, 403, 404 |

### Thread Reports

| Method | Path | Auth | Description | Request Body | Response | Errors |
|--------|------|------|-------------|-------------|----------|--------|
| POST | /api/organizations/:orgId/threads/:threadId/reports | Yes (User+) | Report thread | `{reason:string}` | 201 `{report}` | 400, 401, 404 |
| GET | /api/organizations/:orgId/reports | Yes (Mod/Admin) | List reports | `?status,page,limit` | 200 `{data:[report],total,page,limit}` | 401, 403 |
| PUT | /api/organizations/:orgId/reports/:reportId | Yes (Mod/Admin) | Update status | `{status:enum}` | 200 `{report}` | 400, 401, 403, 404 |

### Announcements

| Method | Path | Auth | Description | Request Body | Response | Errors |
|--------|------|------|-------------|-------------|----------|--------|
| POST | /api/organizations/:orgId/announcements | Yes (Admin) | Create | `{title:string, body:string, displayOrder:int, startDate:datetime, endDate:datetime}` | 201 `{announcement}` | 400, 401, 403 |
| GET | /api/organizations/:orgId/announcements | Yes | List | `?includeExpired,page,limit` | 200 `{data:[announcement]}` | 401 |
| GET | /api/organizations/:orgId/announcements/:id | Yes | Get one | — | 200 `{announcement}` | 401, 404 |
| PUT | /api/organizations/:orgId/announcements/:id | Yes (Admin) | Update | `{title?,body?,displayOrder?,startDate?,endDate?,isPublished?}` | 200 `{announcement}` | 400, 401, 403, 404 |
| DELETE | /api/organizations/:orgId/announcements/:id | Yes (Admin) | Delete | — | 204 | 401, 403, 404 |

### Carousel

| Method | Path | Auth | Description | Request Body | Response | Errors |
|--------|------|------|-------------|-------------|----------|--------|
| POST | /api/organizations/:orgId/carousel | Yes (Admin) | Create item | `{title:string, imageUrl?:string, linkUrl?:string, displayOrder:int, startDate:datetime, endDate:datetime}` | 201 `{item}` | 400, 401, 403 |
| GET | /api/organizations/:orgId/carousel | Yes | List items | `?includeExpired` | 200 `{data:[item]}` | 401 |
| PUT | /api/organizations/:orgId/carousel/:id | Yes (Admin) | Update item | `{title?,imageUrl?,linkUrl?,displayOrder?,startDate?,endDate?,isActive?}` | 200 `{item}` | 400, 401, 403, 404 |
| DELETE | /api/organizations/:orgId/carousel/:id | Yes (Admin) | Delete item | — | 204 | 401, 403, 404 |

### Venues & Bookings

| Method | Path | Auth | Description | Request Body | Response | Errors |
|--------|------|------|-------------|-------------|----------|--------|
| POST | /api/organizations/:orgId/venues | Yes (Admin) | Create venue | `{name:string, description?:string, capacity?:int}` | 201 `{venue}` | 400, 401, 403 |
| GET | /api/organizations/:orgId/venues | Yes | List venues | — | 200 `{data:[venue]}` | 401 |
| GET | /api/organizations/:orgId/venues/:venueId | Yes | Get venue | — | 200 `{venue}` | 401, 404 |
| PUT | /api/organizations/:orgId/venues/:venueId | Yes (Admin) | Update venue | `{name?,description?,capacity?,isActive?}` | 200 `{venue}` | 400, 401, 403, 404 |
| DELETE | /api/organizations/:orgId/venues/:venueId | Yes (Admin) | Delete venue | — | 204 | 401, 403, 404 |
| POST | /api/organizations/:orgId/venues/:venueId/bookings | Yes (User+) | Book venue | `{title:string, startTime:datetime, endTime:datetime}` | 201 `{booking}` | 400, 401, 409 |
| GET | /api/organizations/:orgId/venues/:venueId/bookings | Yes | List bookings | `?startDate,endDate,status` | 200 `{data:[booking]}` | 401, 404 |
| PUT | /api/organizations/:orgId/bookings/:bookingId | Yes (Author/Admin) | Update booking | `{title?,startTime?,endTime?}` | 200 `{booking}` | 400, 401, 403, 404, 409 |
| DELETE | /api/organizations/:orgId/bookings/:bookingId | Yes (Author/Admin) | Cancel booking | — | 204 | 401, 403, 404 |

### Notifications & Subscriptions

| Method | Path | Auth | Description | Request Body | Response | Errors |
|--------|------|------|-------------|-------------|----------|--------|
| GET | /api/organizations/:orgId/notifications | Yes | My notifications | `?status,page,limit` | 200 `{data:[notification],total,unreadCount}` | 401 |
| PUT | /api/organizations/:orgId/notifications/:id/read | Yes | Mark read | — | 200 `{notification}` | 401, 404 |
| PUT | /api/organizations/:orgId/notifications/read-all | Yes | Mark all read | — | 200 `{updatedCount:int}` | 401 |
| GET | /api/organizations/:orgId/subscriptions | Yes | My subscriptions | — | 200 `{data:[subscription]}` | 401 |
| PUT | /api/organizations/:orgId/subscriptions | Yes | Update subscription | `{category:string, isSubscribed:bool}` | 200 `{subscription}` | 400, 401 |

### Audit & Analytics

| Method | Path | Auth | Description | Request Body | Response | Errors |
|--------|------|------|-------------|-------------|----------|--------|
| GET | /api/organizations/:orgId/audit-logs | Yes (Admin/Analyst) | List audit logs | `?action,actorId,resourceType,startDate,endDate,page,limit` | 200 `{data:[log],total,page,limit}` | 401, 403 |
| GET | /api/organizations/:orgId/analytics/funnel | Yes (Admin/Analyst) | Funnel metrics | `?startDate,endDate,granularity` | 200 `{metrics:{views,registrations,posts,engagements,periods:[]}}` | 401, 403 |
| GET | /api/organizations/:orgId/anomalies | Yes (Admin/Mod/Analyst) | List anomalies | `?status,severity,page,limit` | 200 `{data:[anomaly],total,page,limit}` | 401, 403 |
| PUT | /api/organizations/:orgId/anomalies/:id | Yes (Admin/Mod) | Update anomaly | `{status:enum}` | 200 `{anomaly}` | 400, 401, 403, 404 |

### Feature Flags

| Method | Path | Auth | Description | Request Body | Response | Errors |
|--------|------|------|-------------|-------------|----------|--------|
| POST | /api/organizations/:orgId/feature-flags | Yes (Admin) | Create flag | `{key:string, value:object, description?:string}` | 201 `{flag}` | 400, 401, 403, 409 |
| GET | /api/organizations/:orgId/feature-flags | Yes (Admin) | List flags | — | 200 `{data:[flag]}` | 401, 403 |
| PUT | /api/organizations/:orgId/feature-flags/:flagId | Yes (Admin) | Update flag | `{value?:object, description?:string}` | 200 `{flag}` | 400, 401, 403, 404 |
| DELETE | /api/organizations/:orgId/feature-flags/:flagId | Yes (Admin) | Delete flag | — | 204 | 401, 403, 404 |
