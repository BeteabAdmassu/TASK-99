# Audit Report 2 - Fix Check (Static)

## 1. Verdict

- Overall: Pass
- Scope: Static-only re-check of previously reported `audit_report-2` findings.
- Execution boundary: No project start, no Docker, no tests run.

## 2. Re-check Scope

- Authorization boundary fixes (analyst read-only on write operations)
- Documentation consistency for PITR guidance in README
- Security test coverage additions for role-boundary negatives
- Remaining low-risk coverage for real app rate-limit exhaustion (`429`)

## 3. Fix Status by Previous Finding

### A. High - Analyst role not enforced as read-only on content writes

- Status: Fixed
- Evidence:
  - Analyst denied on thread writes: `repo/src/modules/threads/threads.routes.ts:15`, `repo/src/modules/threads/threads.routes.ts:50`, `repo/src/modules/threads/threads.routes.ts:64`
  - Analyst denied on reply writes: `repo/src/modules/replies/replies.routes.ts:16`, `repo/src/modules/replies/replies.routes.ts:44`, `repo/src/modules/replies/replies.routes.ts:59`
  - Analyst denied on booking writes: `repo/src/modules/venues/venues.routes.ts:74`, `repo/src/modules/venues/venues.routes.ts:100`, `repo/src/modules/venues/venues.routes.ts:114`
  - Route-level helper introduced: `repo/src/middleware/rbac.ts:24`
  - Negative tests for analyst write denial (thread/reply/booking create/update/cancel): `repo/tests/integration/security.test.ts:612`, `repo/tests/integration/security.test.ts:742`, `repo/tests/integration/security.test.ts:750`

### B. Medium - README PITR runbook reference broken / missing

- Status: Fixed
- Evidence:
  - Broken link reference removed and inline recovery guidance provided: `repo/README.md:173`, `repo/README.md:179`

### C. Medium - Security tests missing role-boundary negatives

- Status: Fixed
- Evidence:
  - Non-platform-admin org creation denial now tested correctly with real secondary org setup:
    - create secondary org: `repo/tests/integration/security.test.ts:789`
    - admin bound to secondary org: `repo/tests/integration/security.test.ts:797`
    - login with secondary org: `repo/tests/integration/security.test.ts:802`
    - denial assertion: `repo/tests/integration/security.test.ts:822`
  - Non-admin feature-flag create denials: `repo/tests/integration/security.test.ts:860`, `repo/tests/integration/security.test.ts:867`

### D. Low - Rate limiter tests only proved wiring, not real exhaustion

- Status: Fixed
- Evidence:
  - Dedicated real app-path exhaustion tests added: `repo/tests/integration/rate-limit-exhaustion.test.ts:1`
  - Deterministic low-limit setup via env override + module reload: `repo/tests/integration/rate-limit-exhaustion.test.ts:50`, `repo/tests/integration/rate-limit-exhaustion.test.ts:55`
  - Read path returns 429 with payload contract: `repo/tests/integration/rate-limit-exhaustion.test.ts:92`
  - Write path returns 429 with payload contract: `repo/tests/integration/rate-limit-exhaustion.test.ts:129`
  - Header assertions on throttled responses: `repo/tests/integration/rate-limit-exhaustion.test.ts:107`, `repo/tests/integration/rate-limit-exhaustion.test.ts:145`

## 4. Residual Risk (Static)

- Cannot Confirm Statistically:
  - Runtime flakiness characteristics of rate-limit tests under different Jest worker scheduling and CI load.
  - End-to-end production behavior under high concurrency and wall-clock timing.

## 5. Final Conclusion

- All previously remaining `audit_report-2` issues are addressed in code and/or tests from a static evidence perspective.
- Submission readiness (static-only): Pass.
