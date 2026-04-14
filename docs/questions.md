# Business Logic Questions & Decisions

## Decisions Log

1. **User Registration Model**
   - **Question**: The prompt says "username + password login only" but does not specify who creates user accounts. Is there a self-registration endpoint, or are accounts admin-created?
   - **My Understanding**: Since the platform is offline-first and organization-scoped (multi-tenant clubs), self-registration without any verification mechanism would be a security risk. The prompt does not mention a registration page or flow.
   - **Decision**: User accounts are created by Administrators via `POST /api/organizations/:orgId/users`. There is no public self-registration endpoint. The initial admin account is created via a database seed script.
   - **Impact**: If self-registration is intended, a public `POST /api/auth/register` endpoint would need to be added with organization selection logic and possibly an invite code mechanism to prevent unauthorized signups.

2. **Pinned Thread Scope: Per Section vs Per Subsection**
   - **Question**: The prompt says "pinned limited to 3 per section." Does "section" mean the top-level section (across all its subsections) or does it mean per subsection?
   - **My Understanding**: The prompt explicitly says "per section," and sections are the top-level container. A section may have multiple subsections.
   - **Decision**: The 3-pinned limit is enforced per top-level section. When pinning a thread in any subsection, the system counts all currently pinned threads across all subsections belonging to that section's parent. This requires a join query through subsection → section to count.
   - **Impact**: If the limit is per subsection instead, the constraint check simplifies to counting pinned threads within the single subsection. The per-section interpretation is more restrictive and harder to implement but matches the literal prompt.

3. **Notification "Delivery" Semantics in Offline-First Context**
   - **Question**: What does "delivery" mean for in-app-only notifications? The prompt mentions "delivery/open timestamps" and "retries failed deliveries up to 3 times." In an in-app system, what constitutes a delivery failure that needs retrying?
   - **My Understanding**: Since notifications are database records polled by clients, "delivery" likely means the record was successfully created and marked ready for the user to see. A "failure" would be a database write failure or a job processing error — not a network delivery failure.
   - **Decision**: A notification transitions from `pending` → `delivered` when the background job successfully processes and writes it to the database. If the write fails (DB error, constraint violation), it remains `pending` and the retry mechanism kicks in. `read` is set when the user explicitly marks it via the API. The 3 retries with exponential backoff (delays: ~1min, ~4min, ~16min) handle transient database issues during batch notification generation.
   - **Impact**: If "delivery" means something more complex (e.g., push to a local message queue or socket), the notification service would need a delivery confirmation protocol. The database-write interpretation is the simplest that satisfies the offline-first constraint.

4. **Account Lockout Scope and Reset Mechanism**
   - **Question**: The prompt says "lockout after 5 failed attempts within 15 minutes." Does the lockout duration reset the 15-minute window, or is it a fixed 15-minute window from the first failed attempt? Also, does the lockout last exactly 15 minutes, or a different duration?
   - **My Understanding**: The 15-minute window is a rolling window for counting failures. The lockout itself lasts 15 minutes from the moment of the 5th failed attempt (the trigger event).
   - **Decision**: Implementation uses a sliding window: count failed attempts in the last 15 minutes. When the 5th failure occurs, create a lockout record with `expires_at = NOW() + 15 minutes`. During lockout, all login attempts are rejected with 423 regardless of correct credentials. After `expires_at`, the lockout is cleared and the failed attempt counter effectively resets (old attempts fall outside the window).
   - **Impact**: If the lockout should be permanent until admin intervention, we'd need an admin unlock endpoint. If the window is fixed (not sliding), the counting logic changes. The sliding window + auto-expiry approach is standard and more user-friendly.

5. **"Cancellations/Undos" in Anomaly Detection Rules**
   - **Question**: The prompt mentions "≥20 cancellations/undos within 1 hour flags a user." What counts as a "cancellation" or "undo" in the forum context? The prompt doesn't define an explicit undo feature.
   - **My Understanding**: In the context of this platform, "cancellations" could refer to venue booking cancellations, and "undos" could mean content deletions (soft-deletes that go to the recycle bin), edit reversions, or restored-then-re-deleted items. The prompt likely means any destructive or reversal actions.
   - **Decision**: Track the following actions as "cancellations/undos" for this anomaly rule: venue booking cancellations (DELETE booking), thread deletions (soft-delete), reply deletions (soft-delete), recycle bin restores (undo of a delete), and bulk delete actions (each item counts individually). The anomaly detection job counts these actions from the audit_log within a 1-hour rolling window per user.
   - **Impact**: If the definition is narrower (e.g., only venue booking cancellations), the threshold would rarely trigger. If broader (including edits that revert content), we'd need content diff tracking. The middle-ground interpretation covers the most likely abuse patterns.

6. **Venue Booking Conflict Validation — Edge Cases**
   - **Question**: The prompt says "preventing overlapping bookings within the same room." Does this include exact boundary matching (booking ends at 2:00 PM, another starts at 2:00 PM)? Are cancelled bookings excluded from conflict checks?
   - **My Understanding**: Adjacent bookings (end time = start time) should be allowed — this is standard for room booking systems. Only truly overlapping time ranges should conflict. Cancelled bookings should not block new bookings.
   - **Decision**: Conflict check uses `start_time < existing.end_time AND end_time > existing.start_time` (exclusive boundaries) and only considers bookings with `status = 'confirmed'`. Cancelled bookings are ignored. The check runs inside a transaction with a row-level lock to prevent race conditions.
   - **Impact**: If inclusive boundaries are intended (no back-to-back bookings), the check would use `<=` / `>=`. If cancelled bookings should still block (unlikely), they'd be included in the query. The exclusive-boundary approach maximizes room utilization.

7. **Audit Log Immutability Enforcement**
   - **Question**: The prompt says "immutable auditLogId with append-only storage." How strictly should immutability be enforced? At the application level only, or at the database level too?
   - **My Understanding**: The audit log should be tamper-resistant. Application-level enforcement (no UPDATE/DELETE endpoints or service methods) is the minimum. Database-level enforcement (triggers or revoked permissions) provides stronger guarantees.
   - **Decision**: Enforce at both levels. The application layer has no update or delete methods for audit logs. At the database level, the Prisma schema does not define any update operations for the audit_logs model. Additionally, the audit service only exposes a `create` method and query methods — no `update` or `delete`. A MySQL trigger can be added as an extra safeguard: `BEFORE UPDATE ON audit_logs ... SIGNAL SQLSTATE '45000'` and `BEFORE DELETE ON audit_logs ... SIGNAL SQLSTATE '45000'`.
   - **Impact**: If only application-level enforcement is acceptable, the DB triggers can be omitted for simplicity. The dual approach provides defense-in-depth for audit integrity.

8. **Funnel Metrics Granularity and "View" Definition**
   - **Question**: The prompt says the dashboard returns "view → registration → post → engagement" funnel metrics computed from event tables. What counts as a "view" in a backend-only API with no frontend tracking? What counts as "engagement"?
   - **My Understanding**: Without a frontend, "view" must be tracked via API calls. The most reasonable mapping: `view` = any authenticated API request (or specifically GET on threads/sections), `registration` = user account creation event, `post` = thread or reply creation, `engagement` = replies, reports, or bookings (actions beyond passive reading).
   - **Decision**: Track events in the `event_logs` table. A `page_view` event is logged when a user hits `GET /api/organizations/:orgId/threads/:id` (thread detail view). `registration` is logged on `POST .../users`. `post_created` on thread or reply creation. `engagement` on reply creation, thread report, or venue booking. The funnel aggregation query groups by time period (day/week/month) and counts distinct users at each stage.
   - **Impact**: If "view" should include all API reads (not just thread views), the event volume increases significantly. If "engagement" has a different definition, the aggregation query changes. This interpretation creates a meaningful conversion funnel from passive browsing to active participation.

9. **JWT Token Expiry Duration**
   - **Question**: The prompt says "session or signed tokens stored locally" but does not specify token lifetime or refresh strategy.
   - **My Understanding**: For an offline-first system with no external dependencies, tokens should have a reasonable expiry that balances security and usability. No refresh token mechanism is specified.
   - **Decision**: JWT tokens expire after 24 hours. No refresh token flow — users re-authenticate after expiry. The `jti` (JWT ID) claim is included for logout/blacklisting support. The token blacklist table auto-purges entries past their `expires_at`.
   - **Impact**: If shorter expiry (1 hour) is preferred, users would need to re-login frequently, which may not suit an offline-first community forum. If longer (7 days), the security window for stolen tokens widens. 24 hours is a pragmatic middle ground. A refresh token mechanism could be added later if needed.

10. **Thread Deletion Cascading to Replies**
    - **Question**: When a thread is soft-deleted (moved to recycle bin), what happens to its replies? Are they also soft-deleted, or do they remain but become inaccessible because the parent thread is deleted?
    - **My Understanding**: Since the thread is soft-deleted (not hard-deleted), replies still exist in the database. The question is whether they should individually appear in the recycle bin for separate restoration, or if restoring the thread automatically makes its replies visible again.
    - **Decision**: Soft-deleting a thread sets `deleted_at` on the thread only. Replies are not individually marked as deleted — they become inaccessible because the thread list/detail queries filter out deleted threads. Restoring the thread from the recycle bin makes all its replies visible again. However, individually soft-deleted replies (deleted before the thread was deleted) remain in the recycle bin independently.
    - **Impact**: If replies should also be individually soft-deleted when a thread is deleted, the recycle bin gets more granular (each reply can be restored independently of its thread). This adds complexity to both the deletion and restoration logic. The simpler approach (thread-level soft delete only) matches typical forum behavior.

11. **Bulk Action Scope and Atomicity**
    - **Question**: For bulk content actions, should the operation be atomic (all-or-nothing) or partial (process as many as possible, report failures)?
    - **My Understanding**: For moderation workflows, partial success is more practical. A moderator deleting 50 threads shouldn't have the entire operation fail because one thread was already deleted.
    - **Decision**: Bulk actions use partial processing. The response includes `{processed: number, failed: number, errors?: [{resourceId, reason}]}`. Each item is processed independently within the same database transaction batch. If an individual item fails (already deleted, not found, wrong type), it's recorded as a failure but doesn't block other items.
    - **Impact**: If atomic behavior is required, a single failure would roll back all changes. The partial approach is more user-friendly for moderation but means the moderator needs to review the response for failures.

12. **Email Field — Collection and Purpose**
    - **Question**: The prompt says "encrypt sensitive fields at rest (e.g., email if collected for display only, never for verification)." Is email a required field? Can it be searched/filtered, or is it purely for display?
    - **My Understanding**: Email is optional and exists only for display purposes within the organization (e.g., showing contact info on a user profile). Since it's encrypted at rest with AES-256-GCM, it cannot be indexed or searched efficiently.
    - **Decision**: Email is an optional field on user creation. It's stored encrypted (`email_encrypted` as VARBINARY). It's decrypted only when returning user detail to authorized viewers (admin, moderator, or the user themselves). It cannot be used for filtering, searching, or login. It is never logged in plaintext.
    - **Impact**: If email needs to be searchable (e.g., "find user by email"), a separate hashed index column would be needed, adding complexity. The display-only interpretation is the simplest that satisfies the prompt's explicit constraints.
