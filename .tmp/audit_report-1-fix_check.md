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
  - docs/pitr-restore.md was removed per documentation cleanup (docs/ now contains only api-spec.md, design.md, questions.md)
  - PITR guidance (including placeholder credential variables) is inlined in repo/README.md lines 173–181 under "Database Backup and Recovery"
  - repo/docker-compose.yml:14 documents current compose root password source

### 5) Seeded admin password hardcoded constant removal

- Status: Fixed
- Evidence:
  - repo/prisma/seed.ts:9 reads `process.env.SEED_ADMIN_PASSWORD`
  - repo/prisma/seed.ts:10 fails fast if missing
  - repo/README.md:32 explains password source is `SEED_ADMIN_PASSWORD`

## Additional Static Findings

### TypeScript diagnostic in `threads.service.ts`

- Status: Resolved
- Resolution evidence:
  - repo/src/modules/threads/threads.service.ts no longer imports `@prisma/client` directly.
  - Local transaction client typing is derived from the prisma singleton (`type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];`).

### Deprecated `moduleResolution` compiler option

- Status: Resolved
- Previous state: repo/tsconfig.json used `"moduleResolution": "node10"` (deprecated in TypeScript 5.0+) suppressed by `"ignoreDeprecations": "5.0"`.
- Resolution evidence:
  - repo/tsconfig.json now sets `"moduleResolution": "node16"` (correct non-deprecated alias for `module: "commonjs"`).
  - `"ignoreDeprecations": "5.0"` has been removed.
  - Workspace diagnostics return no errors.

## Final Conclusion

- Functional remediation items are addressed.
- No remaining static diagnostics were observed in the previously affected area or workspace-level error pass.
- Submission readiness: Pass (static-only assessment).
