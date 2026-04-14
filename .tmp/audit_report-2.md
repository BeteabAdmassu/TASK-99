# CivicForum Operations Platform - Static Delivery Acceptance and Architecture Audit (Iteration 2)

## 1. Verdict
- Overall conclusion: Partial Pass
- Rationale: The repository is largely complete and aligned to the backend forum operations scope, but there is at least one material authorization mismatch against the Prompt (Analyst read-only semantics), plus static verifiability/test-coverage gaps that can mask severe permission defects.

## 2. Scope and Static Verification Boundary
- What was reviewed:
  - Project docs and run/test instructions: repo/README.md:1-179, repo/package.json:1-54, repo/jest.config.ts:1-18, repo/run_tests.sh:1-19
  - App wiring and entrypoints: repo/src/app.ts:1-100, repo/src/server.ts:1-31
  - Security/authz middleware: repo/src/middleware/auth.ts:1-90, repo/src/middleware/rbac.ts:1-29, repo/src/middleware/orgScope.ts:1-20, repo/src/middleware/checkBanMute.ts:1-36, repo/src/middleware/rateLimiter.ts:1-33
  - Core domain/services and constraints: repo/prisma/schema.prisma:1-503 and multiple module services/routes (auth, users, threads, replies, moderation, venues, notifications, subscriptions, analytics, anomalies, audit, feature flags)
  - Backup/scheduler: repo/src/jobs/scheduler.ts:1-57, repo/src/jobs/backup.ts:1-13, repo/scripts/backup.sh:1-17
  - Static tests: repo/tests/integration/*.test.ts, repo/tests/api_tests.sh:1-744
- What was not reviewed:
  - Runtime behavior under actual execution, Docker orchestration behavior, real DB migrations at runtime, performance characteristics under load.
- What was intentionally not executed:
  - Project startup, Docker, tests, scripts, migrations.
- Claims requiring manual verification:
  - p95 performance target at 500 concurrent users.
  - Actual backup restore/PITR runbook operability (also impacted by missing referenced document).
  - Runtime correctness of cron scheduling and failure handling under real clock/timezone/container conditions.

## 3. Repository / Requirement Mapping Summary
- Prompt core goal mapped: offline-first, multi-tenant forum operations backend with moderation, configuration, auditability, local-only notifications, and local jobs.
- Core flows mapped: auth/login+lockout, org-scoped CRUD for users/sections/threads/replies/tags, moderation/recycle bin, announcements/carousel, venues/bookings conflict checks, subscriptions+notifications+retry, audit logs, anomaly detection, analytics funnel, feature-flagged scheduling, backups.
- Major constraints checked: role model exists (admin/moderator/analyst/user), org scoping, key uniqueness constraints, bcrypt hashing, AES-GCM encryption utility, structured logging with redaction, Dockerized deployment artifacts.

## 4. Section-by-section Review

### 1. Hard Gates

#### 1.1 Documentation and static verifiability
- Conclusion: Partial Pass
- Rationale: Startup/run/test instructions and structure are mostly clear and statically consistent, but README references a PITR runbook that is not present, reducing static verifiability for restore procedures.
- Evidence:
  - repo/README.md:8-45, repo/README.md:173, repo/README.md:177
  - docs directory contents: docs/api-spec.md, docs/design.md, docs/plan.md, docs/questions.md (no pitr-restore.md)
  - file search for pitr-restore.md returned none
- Manual verification note: Manual restore procedure cannot be followed from repository artifacts as-is due to missing referenced runbook.

#### 1.2 Material deviation from Prompt
- Conclusion: Partial Pass
- Rationale: Most business scope is implemented, but Analyst role is not enforced as read-only in forum write paths.
- Evidence:
  - Analyst role exists: repo/prisma/schema.prisma:11-16, repo/src/modules/users/users.schema.ts:6,14,19
  - Thread write routes have no role guard except state updates: repo/src/modules/threads/threads.routes.ts:13-70; state update restricted only at repo/src/modules/threads/threads.routes.ts:75
  - Reply write routes have no role guard: repo/src/modules/replies/replies.routes.ts:13-68
  - Service ownership checks only restrict role user, not analyst: repo/src/modules/threads/threads.service.ts:249,329 and repo/src/modules/replies/replies.service.ts:148,177
- Manual verification note: Runtime exploitability is highly likely from static code paths but still requires execution to demonstrate end-to-end.

### 2. Delivery Completeness

#### 2.1 Core requirements coverage
- Conclusion: Partial Pass
- Rationale: Broad functional coverage exists across modules and schema constraints, but one explicit role-behavior requirement (analyst read-only) is not fully met.
- Evidence:
  - Route/module coverage in app assembly: repo/src/app.ts:63-91
  - Key constraints and models: repo/prisma/schema.prisma:117,260,404-423,481

#### 2.2 End-to-end deliverable vs partial demo
- Conclusion: Pass
- Rationale: Repository includes complete backend structure, docker artifacts, migrations/schema, route/service layering, and both Jest and shell-based test assets.
- Evidence:
  - repo/Dockerfile, repo/docker-compose.yml:1-72, repo/prisma/schema.prisma:1-503, repo/src/app.ts:1-100, repo/tests/api_tests.sh:1-744

### 3. Engineering and Architecture Quality

#### 3.1 Engineering structure and module decomposition
- Conclusion: Pass
- Rationale: Modules are decomposed by domain with middleware/config/jobs separation; no single-file anti-pattern observed.
- Evidence:
  - repo/src/app.ts:12-29,63-91; module and middleware folder structure under repo/src

#### 3.2 Maintainability/extensibility
- Conclusion: Partial Pass
- Rationale: Overall maintainability is good, but role semantics are encoded inconsistently (read-only analyst intent not centralized/enforced), increasing future authz drift risk.
- Evidence:
  - Role guard utility exists: repo/src/middleware/rbac.ts:5-18
  - Write authorization diverges by service-specific role checks: repo/src/modules/threads/threads.service.ts:249,329; repo/src/modules/replies/replies.service.ts:148,177

### 4. Engineering Details and Professionalism

#### 4.1 Error handling, logging, validation, API design
- Conclusion: Pass
- Rationale: Centralized error middleware, typed app errors, input validation via Zod, and structured redacted logging are present.
- Evidence:
  - repo/src/middleware/errorHandler.ts:6-35
  - repo/src/middleware/validate.ts (used broadly in routes), e.g. repo/src/modules/auth/auth.routes.ts:11,53
  - repo/src/config/logger.ts:4-31
  - Booking cross-field validation present: repo/src/modules/venues/venues.schema.ts:16-33

#### 4.2 Real service vs demo shape
- Conclusion: Pass
- Rationale: Includes persistence, scheduling, multi-module APIs, and operational concerns (backup/token cleanup/anomaly jobs).
- Evidence:
  - repo/src/server.ts:8-23
  - repo/src/jobs/scheduler.ts:24-53
  - repo/scripts/backup.sh:1-17

### 5. Prompt Understanding and Requirement Fit

#### 5.1 Business goal and implicit constraints fit
- Conclusion: Partial Pass
- Rationale: Core forum operations objective is implemented, but Prompt semantics for Analyst read-only behavior are not enforced in key write paths.
- Evidence:
  - Prompt-required role set represented in code: repo/prisma/schema.prisma:11-16
  - Non-read-only analyst effective behavior via open write routes and service checks: repo/src/modules/threads/threads.routes.ts:13-70, repo/src/modules/replies/replies.routes.ts:13-68, repo/src/modules/threads/threads.service.ts:249,329, repo/src/modules/replies/replies.service.ts:148,177

### 6. Aesthetics (frontend-only)
- Conclusion: Not Applicable
- Rationale: This deliverable is backend-only (Express/TypeScript/Prisma service), no frontend UI artifacts in reviewed scope.

## 5. Issues / Suggestions (Severity-Rated)

### [High] Analyst role is not enforced as read-only on content write operations
- Conclusion: Fail (against Prompt role semantics)
- Evidence:
  - Analyst role is a first-class role: repo/prisma/schema.prisma:11-16; repo/src/modules/users/users.schema.ts:6
  - Thread write endpoints are open to authenticated users without role restriction: repo/src/modules/threads/threads.routes.ts:13,48,62
  - Reply write endpoints are open to authenticated users without role restriction: repo/src/modules/replies/replies.routes.ts:13,41,56
  - Service-level ownership checks only restrict role user (analyst bypasses user-only restriction): repo/src/modules/threads/threads.service.ts:249,329; repo/src/modules/replies/replies.service.ts:148,177
- Impact:
  - Analysts can create/update/delete operational content, violating read-only operations/reporting intent and weakening least-privilege boundaries.
- Minimum actionable fix:
  - Enforce analyst read-only globally on write routes (middleware such as denyRoles('analyst') for write methods) and/or expand service guards to allow only owner for role user and deny analyst writes unless explicitly permitted.

### [Medium] README references non-existent PITR runbook, reducing static verifiability of recovery process
- Conclusion: Partial Fail (documentation hard-gate quality)
- Evidence:
  - README references docs/pitr-restore.md: repo/README.md:173,177
  - No such file in workspace docs: docs contains api-spec.md, design.md, plan.md, questions.md
- Impact:
  - Reviewer/operator cannot statically verify or follow documented point-in-time restore procedure from repository artifacts.
- Minimum actionable fix:
  - Add the referenced runbook at docs/pitr-restore.md or update README to point to the actual existing restore documentation.

### [Medium] Security test coverage misses role-boundary negatives for high-risk authorization rules
- Conclusion: Partial Fail (test adequacy for authz risk)
- Evidence:
  - No analyst role tests found in test suite
  - Existing object-level auth tests only cover user vs user ownership: repo/tests/integration/security.test.ts:492-612
  - Organization create test covers only positive platform-admin path, no negative non-platform-admin assertion: repo/tests/api_tests.sh:391
- Impact:
  - Critical permission regressions (especially analyst read-only and platform-admin boundaries) can slip through while tests still pass.
- Minimum actionable fix:
  - Add explicit negative tests:
    - analyst cannot POST/PUT/DELETE threads/replies/bookings
    - non-platform-admin cannot create organizations
    - moderator/analyst permission boundaries on admin-only endpoints

### [Low] Rate-limit tests do not verify the actual production limiter wiring/thresholds
- Conclusion: Partial Pass with gap
- Evidence:
  - Tests instantiate standalone limiter in a mini express app, not the app middleware configuration: repo/tests/integration/security.test.ts:83-106,118-138
  - Production limiter config lives in middleware: repo/src/middleware/rateLimiter.ts:4-33
- Impact:
  - Regressions in real limiter keying/window/max settings may not be detected by current tests.
- Minimum actionable fix:
  - Add integration tests against real endpoints that exceed configured thresholds (or test with injectable env overrides for deterministic limits).

## 6. Security Review Summary

- authentication entry points: Pass
  - Evidence: login/logout/me/password routes with auth middleware on protected endpoints: repo/src/modules/auth/auth.routes.ts:8-60; token verification/blacklist checks: repo/src/middleware/auth.ts:16-52
- route-level authorization: Partial Pass
  - Evidence: widespread auth/orgScope/requireRole usage across modules; however write routes for threads/replies are not role-restricted and conflict with analyst read-only semantics: repo/src/modules/threads/threads.routes.ts:13-70, repo/src/modules/replies/replies.routes.ts:13-68
- object-level authorization: Partial Pass
  - Evidence: owner checks for role user in thread/reply update/delete: repo/src/modules/threads/threads.service.ts:249,329; repo/src/modules/replies/replies.service.ts:148,177; booking owner/admin checks: repo/src/modules/venues/venues.service.ts:243-247,347-351
  - Gap: checks are role-conditional and allow analyst bypass of user-only ownership restriction.
- function-level authorization: Partial Pass
  - Evidence: admin/moderator role guards on moderation/thread-state/feature-flag actions: repo/src/modules/moderation/moderation.routes.ts:14-51, repo/src/modules/threads/threads.routes.ts:75, repo/src/modules/feature-flags/feature-flags.routes.ts:14-51
  - Gap: missing analyst read-only function restrictions on generic content writes.
- tenant / user isolation: Pass
  - Evidence: orgScope middleware enforces token org vs path org: repo/src/middleware/orgScope.ts:4-20; auth user lookup scoped by org claim: repo/src/middleware/auth.ts:32-34; schema uses orgId fields and indexes broadly: repo/prisma/schema.prisma:81-499
- admin / internal / debug protection: Pass
  - Evidence: no exposed debug/internal endpoints found in src scan; organization creation guarded by requirePlatformAdmin: repo/src/modules/organizations/organizations.routes.ts:14-17 and repo/src/middleware/rbac.ts:20-29

## 7. Tests and Logging Review

- Unit tests: Partial Pass
  - Rationale: Predominantly integration-style tests; few isolated unit tests.
  - Evidence: test suite centered in repo/tests/integration/*.test.ts and shell API script repo/tests/api_tests.sh:1-744.
- API / integration tests: Partial Pass
  - Rationale: Good breadth of endpoint/status checks, but important role-boundary negatives are missing.
  - Evidence: repo/tests/integration/security.test.ts:492-612, repo/tests/api_tests.sh:391,705
- Logging categories / observability: Pass
  - Rationale: Structured pino logger with log levels and correlation IDs.
  - Evidence: repo/src/config/logger.ts:4-31, repo/src/middleware/correlationId.ts, repo/src/app.ts:44-48
- Sensitive-data leakage risk in logs / responses: Partial Pass
  - Rationale: Redaction list is strong for known fields; static analysis cannot guarantee no future custom payload leakage in arbitrary log contexts.
  - Evidence: repo/src/config/logger.ts:7-18

## 8. Test Coverage Assessment (Static Audit)

### 8.1 Test Overview
- Unit and integration tests exist:
  - Jest integration suites: repo/tests/integration/auth.test.ts, health.test.ts, users.test.ts, threads.test.ts, remediation.test.ts, security.test.ts
  - Shell API suite: repo/tests/api_tests.sh:1-744 (invoked by repo/run_tests.sh:19)
- Test frameworks:
  - Jest + ts-jest + supertest: repo/package.json:10,44,47 and repo/jest.config.ts:1-18
  - curl/jq shell HTTP tests: repo/tests/api_tests.sh:1-56
- Test entry points:
  - npm test -> jest: repo/package.json:10
  - run_tests.sh waits for health then executes API shell suite: repo/run_tests.sh:1-19
- Docs test commands exist:
  - repo/README.md:40-44

### 8.2 Coverage Mapping Table

| Requirement / Risk Point | Mapped Test Case(s) | Key Assertion / Fixture / Mock | Coverage Assessment | Gap | Minimum Test Addition |
|---|---|---|---|---|---|
| Login success/failure + 12-char validation | repo/tests/integration/auth.test.ts:8-32; repo/tests/api_tests.sh:72-84 | 200 token, 401 wrong pass, 400 short password | sufficient | None material | Keep regression tests |
| Lockout after repeated failures | repo/tests/integration/security.test.ts:27-76 | 5x 401 then 6th 423 ACCOUNT_LOCKED | basically covered | Boundary interpretation (exact 5th behavior) not asserted | Add assertion clarifying expected behavior at 5th failure boundary |
| Route auth 401 without token | repo/tests/integration/auth.test.ts:43-45; repo/tests/api_tests.sh:102 | 401 on protected route | sufficient | None material | Keep |
| Tenant org isolation | repo/tests/api_tests.sh:705 | Wrong org returns 403 | basically covered | Single-path check only; no cross-tenant write attempts | Add cross-tenant POST/PUT/DELETE negative tests |
| Object-level ownership (user cannot modify others) | repo/tests/integration/security.test.ts:559-588 | User B gets 403 on A's thread/reply update/delete | sufficient (for user role) | No equivalent for analyst/moderator boundaries | Add analyst/moderator ownership and capability matrix tests |
| Thread state rules (locked, archived, pinned max 3) | repo/tests/api_tests.sh:226,236; repo/tests/integration/security.test.ts:148-218 | 403 locked/archived; 400 PINNED_LIMIT_REACHED | sufficient | None material | Keep |
| Reply depth max 3 | repo/tests/integration/security.test.ts:223-288 | Depth progression 1..3, 400 MAX_NESTING_DEPTH | sufficient | None material | Keep |
| Booking overlap conflict | repo/tests/api_tests.sh:300 | 409 overlap | basically covered | No concurrent-race simulation | Add transaction race test with parallel booking attempts |
| Feature flag uniqueness + CRUD | repo/tests/api_tests.sh:359 and extended CRUD segment | 409 duplicate key, CRUD statuses | basically covered | No role-boundary negatives | Add non-admin 403 tests |
| Organization create platform-admin boundary | repo/tests/api_tests.sh:391 | Positive 201 only | insufficient | Missing non-platform-admin denied case | Add explicit 403/forbidden test for non-platform-admin |
| Analyst read-only requirement | none found | n/a | missing | No tests enforce analyst write denial | Add analyst POST/PUT/DELETE denial tests on threads/replies/bookings |
| Rate limiting behavior | repo/tests/integration/security.test.ts:80-142 | standalone mock app returns RATE_LIMITED payload | insufficient | Does not validate real app middleware thresholds/config | Add endpoint-level limiter tests with low configurable limits |
| Sensitive log redaction | none found | n/a | missing | No test verifies redaction in emitted logs | Add logger redaction tests for password/token/email fields |

### 8.3 Security Coverage Audit
- authentication: basically covered
  - Evidence: auth.test and security lockout tests cover login/me/logout and lockout paths.
- route authorization: insufficient
  - Evidence: many positive/negative status checks exist, but limited role-matrix negatives; analyst read-only not tested.
- object-level authorization: basically covered for regular users, insufficient for role variants
  - Evidence: user-vs-user ownership checks present; no analyst/moderator matrix.
- tenant / data isolation: basically covered
  - Evidence: one wrong-org 403 check exists; broader cross-tenant mutation cases missing.
- admin / internal protection: insufficient
  - Evidence: platform-admin create-org only positive case tested; no explicit non-admin/non-platform-admin denial coverage.

### 8.4 Final Coverage Judgment
- Partial Pass
- Boundary explanation:
  - Covered: core auth flows, key business-rule constraints (pinned/depth/lockout), many CRUD happy paths, selected error statuses.
  - Not sufficiently covered: role-boundary negatives (especially analyst read-only), platform-admin denial cases, real limiter wiring, sensitive-log redaction checks.
  - As a result, tests could still pass while severe authorization defects remain.

## 9. Final Notes
- This audit is static-only; no runtime behavior was inferred from execution.
- Primary root-cause risk is authorization semantics drift between Prompt role intent and route/service enforcement.
- Documentation and test coverage are strong in breadth but still have targeted high-impact gaps that should be closed before final acceptance.