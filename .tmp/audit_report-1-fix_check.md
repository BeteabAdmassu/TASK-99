# Audit Report 1 - Fix Check (Static)

## Verdict

- Overall: Pass

## Scope

- Static-only re-check of previously flagged remaining issues.
- No runtime execution, no Docker, no tests were run.

## Item-by-item Fix Status

### 1) README password-rotation endpoint correctness

- Status: Fixed
- Evidence:
  - repo/README.md:34 now points to `PUT /api/auth/password`
  - repo/README.md:34 includes auth requirement and body fields (`currentPassword`, `newPassword`)

### 2) Lockout test uses validation-compliant wrong password

- Status: Fixed
- Evidence:
  - repo/tests/integration/security.test.ts:55 uses `WrongPassword123!` (length >= 12)
  - repo/tests/integration/security.test.ts:51 asserts repeated 401 behavior before lockout

### 3) Feature-flag configuration applied to core limits

- Status: Fixed
- Evidence:
  - repo/src/modules/threads/threads.service.ts:365 compares pinned count against `cfg.maxPinnedThreadsPerSection`
  - repo/src/modules/replies/replies.service.ts:46 checks depth against `cfg.maxReplyDepth`
  - repo/src/config/appConfig.ts:68 provides central DB-driven config contract and defaults

### 4) PITR runbook credential example consistency

- Status: Fixed
- Evidence:
  - docs/pitr-restore.md:33 now uses placeholder `DB_ROOT_PASS="<MYSQL_ROOT_PASSWORD>"`
  - repo/docker-compose.yml:14 documents current compose root password source

### 5) Seeded admin password hardcoded constant removal

- Status: Fixed
- Evidence:
  - repo/prisma/seed.ts:9 reads `process.env.SEED_ADMIN_PASSWORD`
  - repo/prisma/seed.ts:10 fails fast if missing
  - repo/README.md:32 explains password source is `SEED_ADMIN_PASSWORD`

## Additional Static Finding

- Status: Resolved
- Previous finding: TypeScript diagnostic in `threads.service.ts`
- Resolution evidence:
  - repo/src/modules/threads/threads.service.ts no longer imports `@prisma/client` directly.
  - Local transaction client typing is derived from the prisma singleton (`type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];`).
  - Workspace diagnostics check returned no errors.

## Final Conclusion

- Functional remediation items are addressed.
- No remaining static diagnostics were observed in the previously affected area or workspace-level error pass.
- Submission readiness: Pass (static-only assessment).
