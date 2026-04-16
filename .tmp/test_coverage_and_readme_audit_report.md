# Test Coverage Audit

## Project Type Detection
- README does **not** declare a top-level type token (`backend/fullstack/web/android/ios/desktop`).
- Inferred project type: **backend** (evidence: Express API surface in `repo/src/app.ts:58`, route modules under `repo/src/modules`, no frontend app directory).

## Backend Endpoint Inventory
Resolved from `repo/src/app.ts:58` and mounted routers in `repo/src/app.ts:67`-`repo/src/app.ts:88`.

1. `GET /api/health`
2. `POST /api/auth/login`
3. `POST /api/auth/logout`
4. `GET /api/auth/me`
5. `PUT /api/auth/password`
6. `POST /api/organizations`
7. `GET /api/organizations/:orgId`
8. `PUT /api/organizations/:orgId`
9. `POST /api/organizations/:orgId/users`
10. `GET /api/organizations/:orgId/users`
11. `GET /api/organizations/:orgId/users/:userId`
12. `PUT /api/organizations/:orgId/users/:userId/role`
13. `POST /api/organizations/:orgId/users/:userId/ban`
14. `POST /api/organizations/:orgId/users/:userId/unban`
15. `POST /api/organizations/:orgId/users/:userId/mute`
16. `POST /api/organizations/:orgId/users/:userId/unmute`
17. `POST /api/organizations/:orgId/sections`
18. `GET /api/organizations/:orgId/sections`
19. `GET /api/organizations/:orgId/sections/:sectionId`
20. `PUT /api/organizations/:orgId/sections/:sectionId`
21. `DELETE /api/organizations/:orgId/sections/:sectionId`
22. `POST /api/organizations/:orgId/sections/:sectionId/subsections`
23. `GET /api/organizations/:orgId/sections/:sectionId/subsections`
24. `PUT /api/organizations/:orgId/subsections/:subId`
25. `DELETE /api/organizations/:orgId/subsections/:subId`
26. `POST /api/organizations/:orgId/threads`
27. `GET /api/organizations/:orgId/threads`
28. `GET /api/organizations/:orgId/threads/:threadId`
29. `PUT /api/organizations/:orgId/threads/:threadId`
30. `DELETE /api/organizations/:orgId/threads/:threadId`
31. `PUT /api/organizations/:orgId/threads/:threadId/state`
32. `POST /api/organizations/:orgId/threads/:threadId/replies`
33. `GET /api/organizations/:orgId/threads/:threadId/replies`
34. `PUT /api/organizations/:orgId/replies/:replyId`
35. `DELETE /api/organizations/:orgId/replies/:replyId`
36. `POST /api/organizations/:orgId/tags`
37. `GET /api/organizations/:orgId/tags`
38. `PUT /api/organizations/:orgId/tags/:tagId`
39. `DELETE /api/organizations/:orgId/tags/:tagId`
40. `POST /api/organizations/:orgId/moderation/bulk-action`
41. `GET /api/organizations/:orgId/recycle-bin`
42. `POST /api/organizations/:orgId/recycle-bin/:itemType/:itemId/restore`
43. `DELETE /api/organizations/:orgId/recycle-bin/:itemType/:itemId`
44. `POST /api/organizations/:orgId/threads/:threadId/reports`
45. `GET /api/organizations/:orgId/reports`
46. `PUT /api/organizations/:orgId/reports/:reportId`
47. `POST /api/organizations/:orgId/announcements`
48. `GET /api/organizations/:orgId/announcements`
49. `GET /api/organizations/:orgId/announcements/:id`
50. `PUT /api/organizations/:orgId/announcements/:id`
51. `DELETE /api/organizations/:orgId/announcements/:id`
52. `POST /api/organizations/:orgId/carousel`
53. `GET /api/organizations/:orgId/carousel`
54. `PUT /api/organizations/:orgId/carousel/:id`
55. `DELETE /api/organizations/:orgId/carousel/:id`
56. `POST /api/organizations/:orgId/venues`
57. `GET /api/organizations/:orgId/venues`
58. `GET /api/organizations/:orgId/venues/:venueId`
59. `PUT /api/organizations/:orgId/venues/:venueId`
60. `DELETE /api/organizations/:orgId/venues/:venueId`
61. `POST /api/organizations/:orgId/venues/:venueId/bookings`
62. `GET /api/organizations/:orgId/venues/:venueId/bookings`
63. `PUT /api/organizations/:orgId/bookings/:bookingId`
64. `DELETE /api/organizations/:orgId/bookings/:bookingId`
65. `GET /api/organizations/:orgId/notifications`
66. `PUT /api/organizations/:orgId/notifications/read-all`
67. `PUT /api/organizations/:orgId/notifications/:id/read`
68. `GET /api/organizations/:orgId/subscriptions`
69. `PUT /api/organizations/:orgId/subscriptions`
70. `GET /api/organizations/:orgId/audit-logs`
71. `GET /api/organizations/:orgId/analytics/funnel`
72. `GET /api/organizations/:orgId/anomalies`
73. `PUT /api/organizations/:orgId/anomalies/:id`
74. `POST /api/organizations/:orgId/feature-flags`
75. `GET /api/organizations/:orgId/feature-flags`
76. `PUT /api/organizations/:orgId/feature-flags/:flagId`
77. `DELETE /api/organizations/:orgId/feature-flags/:flagId`

## API Test Mapping Table
All endpoints are covered by real HTTP requests in `repo/tests/api_tests.sh` (curl against running app).

| Endpoint | Covered | Test Type | Test File(s) | Evidence |
|---|---|---|---|---|
| `GET /api/health` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:110` |
| `POST /api/auth/login` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:121` |
| `POST /api/auth/logout` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:790` |
| `GET /api/auth/me` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:144` |
| `PUT /api/auth/password` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:735` |
| `POST /api/organizations` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:446` |
| `GET /api/organizations/:orgId` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:159` |
| `PUT /api/organizations/:orgId` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:442` |
| `POST /api/organizations/:orgId/users` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:167` |
| `GET /api/organizations/:orgId/users` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:174` |
| `GET /api/organizations/:orgId/users/:userId` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:555` |
| `PUT /api/organizations/:orgId/users/:userId/role` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:558` |
| `POST /api/organizations/:orgId/users/:userId/ban` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:778` |
| `POST /api/organizations/:orgId/users/:userId/unban` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:781` |
| `POST /api/organizations/:orgId/users/:userId/mute` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:772` |
| `POST /api/organizations/:orgId/users/:userId/unmute` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:775` |
| `POST /api/organizations/:orgId/sections` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:192` |
| `GET /api/organizations/:orgId/sections` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:196` |
| `GET /api/organizations/:orgId/sections/:sectionId` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:455` |
| `PUT /api/organizations/:orgId/sections/:sectionId` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:458` |
| `DELETE /api/organizations/:orgId/sections/:sectionId` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:472` |
| `POST /api/organizations/:orgId/sections/:sectionId/subsections` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:200` |
| `GET /api/organizations/:orgId/sections/:sectionId/subsections` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:461` |
| `PUT /api/organizations/:orgId/subsections/:subId` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:464` |
| `DELETE /api/organizations/:orgId/subsections/:subId` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:481` |
| `POST /api/organizations/:orgId/threads` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:229` |
| `GET /api/organizations/:orgId/threads` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:235` |
| `GET /api/organizations/:orgId/threads/:threadId` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:238` |
| `PUT /api/organizations/:orgId/threads/:threadId` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:242` |
| `DELETE /api/organizations/:orgId/threads/:threadId` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:515` |
| `PUT /api/organizations/:orgId/threads/:threadId/state` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:250` |
| `POST /api/organizations/:orgId/threads/:threadId/replies` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:265` |
| `GET /api/organizations/:orgId/threads/:threadId/replies` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:274` |
| `PUT /api/organizations/:orgId/replies/:replyId` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:526` |
| `DELETE /api/organizations/:orgId/replies/:replyId` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:531` |
| `POST /api/organizations/:orgId/tags` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:209` |
| `GET /api/organizations/:orgId/tags` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:213` |
| `PUT /api/organizations/:orgId/tags/:tagId` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:492` |
| `DELETE /api/organizations/:orgId/tags/:tagId` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:501` |
| `POST /api/organizations/:orgId/moderation/bulk-action` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:428` |
| `GET /api/organizations/:orgId/recycle-bin` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:433` |
| `POST /api/organizations/:orgId/recycle-bin/:itemType/:itemId/restore` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:723` |
| `DELETE /api/organizations/:orgId/recycle-bin/:itemType/:itemId` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:726` |
| `POST /api/organizations/:orgId/threads/:threadId/reports` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:303` |
| `GET /api/organizations/:orgId/reports` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:306` |
| `PUT /api/organizations/:orgId/reports/:reportId` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:544` |
| `POST /api/organizations/:orgId/announcements` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:316` |
| `GET /api/organizations/:orgId/announcements` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:320` |
| `GET /api/organizations/:orgId/announcements/:id` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:572` |
| `PUT /api/organizations/:orgId/announcements/:id` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:575` |
| `DELETE /api/organizations/:orgId/announcements/:id` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:584` |
| `POST /api/organizations/:orgId/carousel` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:328` |
| `GET /api/organizations/:orgId/carousel` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:332` |
| `PUT /api/organizations/:orgId/carousel/:id` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:595` |
| `DELETE /api/organizations/:orgId/carousel/:id` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:604` |
| `POST /api/organizations/:orgId/venues` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:340` |
| `GET /api/organizations/:orgId/venues` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:344` |
| `GET /api/organizations/:orgId/venues/:venueId` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:615` |
| `PUT /api/organizations/:orgId/venues/:venueId` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:618` |
| `DELETE /api/organizations/:orgId/venues/:venueId` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:630` |
| `POST /api/organizations/:orgId/venues/:venueId/bookings` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:350` |
| `GET /api/organizations/:orgId/venues/:venueId/bookings` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:621` |
| `PUT /api/organizations/:orgId/bookings/:bookingId` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:641` |
| `DELETE /api/organizations/:orgId/bookings/:bookingId` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:651` |
| `GET /api/organizations/:orgId/notifications` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:363` |
| `PUT /api/organizations/:orgId/notifications/read-all` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:662` |
| `PUT /api/organizations/:orgId/notifications/:id/read` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:677` |
| `GET /api/organizations/:orgId/subscriptions` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:374` |
| `PUT /api/organizations/:orgId/subscriptions` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:371` |
| `GET /api/organizations/:orgId/audit-logs` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:382` |
| `GET /api/organizations/:orgId/analytics/funnel` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:390` |
| `GET /api/organizations/:orgId/anomalies` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:398` |
| `PUT /api/organizations/:orgId/anomalies/:id` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:690` |
| `POST /api/organizations/:orgId/feature-flags` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:406` |
| `GET /api/organizations/:orgId/feature-flags` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:410` |
| `PUT /api/organizations/:orgId/feature-flags/:flagId` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:703` |
| `DELETE /api/organizations/:orgId/feature-flags/:flagId` | yes | true no-mock HTTP | `repo/tests/api_tests.sh` | `repo/tests/api_tests.sh:712` |

## API Test Classification
1. **True No-Mock HTTP**
   - `repo/tests/api_tests.sh` (curl to running app over `localhost`)
   - `repo/tests/integration/health.test.ts`, `repo/tests/integration/auth.test.ts`, `repo/tests/integration/users.test.ts`, `repo/tests/integration/threads.test.ts`, `repo/tests/integration/security.test.ts`, `repo/tests/integration/remediation.test.ts`, `repo/tests/integration/rate-limit-exhaustion.test.ts`, `repo/tests/integration/crud-contracts.test.ts` (supertest through real Express routes in `repo/src/app.ts`)
2. **HTTP with Mocking**
   - None found for API endpoint tests.
3. **Non-HTTP (unit/integration without HTTP)**
   - Direct service/job invocation in `repo/tests/integration/jobs.test.ts`
   - Direct service/prisma invocations in portions of `repo/tests/integration/remediation.test.ts` and `repo/tests/integration/security.test.ts`
   - Unit suites under `repo/tests/unit/*.test.ts`

## Mock Detection (Strict)
- `jest.mock('../../src/config/logger', ...)` in `repo/tests/unit/errorHandler.test.ts:8` (mocks logger).
- `jest.mock('@prisma/client', ...)` in `repo/tests/unit/errorHandler.test.ts:12` (mocks Prisma error class surface).
- These mocks are in **unit tests only**; no evidence of mocked transport/controller/service in endpoint HTTP tests.

## Coverage Summary
- Total endpoints: **77**
- Endpoints with HTTP tests: **77**
- Endpoints with TRUE no-mock API tests: **77**
- HTTP coverage: **100%**
- True API coverage: **100%**

## Unit Test Summary
### Backend Unit Tests
- Unit files: `repo/tests/unit/correlationId.test.ts`, `repo/tests/unit/encryption.test.ts`, `repo/tests/unit/errorHandler.test.ts`, `repo/tests/unit/errors.test.ts`, `repo/tests/unit/masks.test.ts`, `repo/tests/unit/pagination.test.ts`, `repo/tests/unit/validate.test.ts`.
- Covered backend modules:
  - middleware: correlation-id, validation, global error handler
  - utils/config: errors, masks, pagination, encryption
- Important backend modules **not unit-tested** (direct evidence not found):
  - route-level auth/RBAC/org-scope middleware interplay
  - most service layers (`src/modules/*/*.service.ts`), especially organizations/tags/venues/reports/analytics/anomalies logic
  - scheduler bootstrap wiring in `repo/src/jobs/scheduler.ts`

### Frontend Unit Tests (STRICT REQUIREMENT)
- Frontend test files: **NONE**
- Framework/tools detected for frontend tests: **NONE**
- Frontend components/modules covered: **NONE**
- Important frontend modules not tested: not applicable (no frontend module tree found).
- Mandatory verdict: **Not applicable** (project inferred backend, not `web`/`fullstack`).

### Cross-Layer Observation
- No frontend layer found; backend-only test balance is acceptable for inferred project type.

## API Observability Check
- Strong observability in Jest integration tests: explicit method/path, inputs, and response assertions (e.g., `repo/tests/integration/crud-contracts.test.ts:37`, `repo/tests/integration/security.test.ts:31`).
- Mixed observability in Bash suite: broad endpoint coverage but many cases still assert status only; partial payload checks added (e.g., `repo/tests/api_tests.sh:64`, `repo/tests/api_tests.sh:112`, `repo/tests/api_tests.sh:758`).
- Verdict: **moderate-to-strong**, not uniformly deep per endpoint.

## Tests Check
- `run_tests.sh` exists and uses Docker-first flow (`docker compose ... up -d`, then API curl suite, then Dockerized Jest runner): `repo/run_tests.sh:13`, `repo/run_tests.sh:39`.
- No main-flow dependency on host Python/Node detected in `run_tests.sh`.
- Bash-only tests are **not** the only suite anymore; TS integration/unit tests are included via Dockerized runner.
- Suite breadth is high (all routes hit), and depth is improved via security/remediation/contracts/jobs/unit files.

## Test Coverage Score (0-100)
**94/100**

## Score Rationale
- Full endpoint-level HTTP coverage with true no-mock API execution path evidence.
- Strong backend breadth + meaningful failure-path/security assertions.
- Score reduced for uneven per-endpoint assertion depth in `api_tests.sh` and incomplete unit isolation for large service modules.

## Key Gaps
- Some endpoint checks remain status-centric in `repo/tests/api_tests.sh` with limited payload/side-effect verification.
- Large service-layer logic still lacks focused unit tests (beyond utility/middleware layer).
- Mixed style between shell and Jest suites makes contract rigor inconsistent.

## Confidence & Assumptions
- Confidence: **high** for endpoint inventory and coverage mapping.
- Assumption: supertest-based route tests are treated as real HTTP-layer route execution because requests pass through Express middleware/handlers in `repo/src/app.ts` without mocked controllers/services.

---

# README Audit

## README Location
- Found at required path: `repo/README.md`.

## Hard Gate Failures
- None.

## High Priority Issues
- None.

## Medium Priority Issues
- None material.

## Low Priority Issues
- Minor: prerequisites mention host tools `bash/curl/jq` for test execution (`repo/README.md:11`-`repo/README.md:12`), which is acceptable for the host-runner model but could be clarified as CI/runtime tooling expectations.

## Engineering Quality
- Project type declaration: present at top (`repo/README.md:3`).
- Tech stack clarity: strong (`repo/README.md:7`).
- Startup instructions: Docker-first and explicit (`repo/README.md:18`-`repo/README.md:20`).
- Access method: URL and port clearly defined (`repo/README.md:28`).
- Verification method: concrete curl workflows with expected status/body for health, auth, protected access, unauthenticated rejection, and RBAC denial (`repo/README.md:102`-`repo/README.md:209`).
- Environment rules: compliant (no local package/runtime install steps, Docker-contained startup/testing path).
- Demo credentials: complete for all roles (admin plus moderator/analyst/user creation path and credentials table) (`repo/README.md:56`-`repo/README.md:100`).
- Testing instructions: aligned with current test orchestration (`repo/README.md:211`-`repo/README.md:221`).

## README Verdict
**PASS**
