# Structural task delivery

The web port now delivers task creation, explicit deletion lists, parent links and native YouTrack State, alongside titles, notes, priority, complexity and comments. The Parent control in Task Properties queues a move. These paths use the same bound-account session, serial queue, durable journal and editing/update locks as the earlier adapter.

The desktop executable, saves, credentials, assigned-status sidecar and migration archive remain intact. Development and verification use synthetic fixtures. No production task was created, moved, updated or deleted as a test.

## Creation and local IDs

Creation reads PMON's project ID and existing field types before sending. Missing or incompatible configuration blocks creation without schema changes. The payload uses the existing Type, State, Priority and Complexity fields. No project or field configuration is created.

The attempt marker is durable before POST. A returned issue ID is saved before task readback. Matching title, notes, native State, priority, complexity and type are required before confirmation. Confirmation maps the local ID to the cloud ID in one browser transaction: queued issue IDs, edit baselines, parent references, drafts, ordering, expanded branches, selection, scope and the new-item draft. Local creation dependencies are delivered parents first, including a parent queued later. A child is created first as a root, then a separate journaled edit attaches its parent. A failed link does not cause another creation.

A lost creation response stays uncertain, including across reload. There is no title/text search and no automatic POST retry. Review requires the exact returned or user-supplied PMON issue ID and matching fields. Stopping an uncertain creation archives dependent browser changes; a cloud task may already exist and must be inspected before creating again. Conflicting drafts on both IDs block mapping and preserve recovery data.

Deleting a local task that has never been sent cancels its queued subtree locally and archives the queued content. It sends no create/delete requests. The earlier local create/delete queue format is handled the same way. A local creation that might already have reached YouTrack must be reviewed first.

## Parent links

Moves use the discovered inward Subtask link ID and actual target database ID. The adapter reads the destination ancestor chain and rejects unreadable ancestors, multiple parents and cycles. It compares the current parent with the reconciled baseline, reads the full paginated parent-link list, removes the old link, verifies detachment, adds the new link and verifies the resulting parent.

The attempt marker covers the whole move. An interruption can leave a task detached. Readback confirmation sends no write; if the desired parent is not present, an explicit rebase can queue the remaining edit against the current result. The next Save compares again. Comments and creation never use this rebase path.

## Deletion

Queue deletion of listed tasks shows the exact browser list and explains permanent cloud deletion. This action archives pending edits/comments for those targets and captures their cloud baselines. Unposted drafts remain in recovery. A recovery copy cannot restore YouTrack identities, comments or attachments after deletion.

Delivery reads every remaining listed task and all paginated child links. Changed fields, changed timestamps, absent baselines, unreadable tasks or unlisted children stop deletion. Old remote deletion queues without baselines require explicit review. The list never expands automatically.

Deletion proceeds leaves first. Each DELETE has a durable target marker. Its successful response is recorded before checking that the task is no longer readable. Confirmed progress is saved before the next target; later failures keep remaining work and earlier receipts. The next leaf is checked again before deletion. Removing a child may change the parent's timestamp, which deliberately requires another review before deleting that parent.

Review can approve only the displayed current targets. If another change appears during approval, a new snapshot is shown and approval stops. After a lost response, a missing task alone is insufficient for automatic confirmation: the user must acknowledge checking the exact task and that a 404 can also mean lost access. Confirmation never resends that DELETE. Remaining targets require Save and fresh checks. Stopping remaining deletion cannot undo tasks already deleted.

## Native State and limits

The current adapter delivers the selected status to the existing native StateIssueCustomField. The queued state and assignedState aliases must agree. A missing current value or an incompatible field type blocks status delivery. Readback must match the desired State. No status values or fields are created.

The browser computes hierarchy lamps from the accepted rollup rules. It does not import the desktop assigned-status sidecar or propagate derived parent statuses to YouTrack. Cross-device assigned/effective-status parity remains part of the metadata port.

YouTrack requests do not provide an atomic transaction across tasks, an atomic conditional write, or a server idempotency key in this adapter. Other clients can still change data between checks and mutations. Avoid simultaneous desktop/web edits to the same tasks. Deletion checks cover the represented task fields and updated timestamp; they cannot prevent a change made after the last read. Uncertain outcomes require explicit review, with no automatic rollback or silent retry.

Live token permissions, real-origin CORS, workflow effects, full metadata/status parity, recovery import and real-device installation remain unverified. This checkpoint does not replace the desktop fallback.

## API references

Request shapes follow JetBrains' [issue creation](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues.html), [issue updates and deletion](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues.html), [link creation](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues-issueID-links-linkID-issues.html), [link removal](https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues-issueID-links-linkID-issues.html) and [custom-field type mapping](https://www.jetbrains.com/help/youtrack/devportal/api-concept-custom-fields.html) documentation.

## Verification

Verified on October 22, 2026 on codex/accepted-app-port. pnpm check passed TypeScript, formatting, zero-warning lint, 44 component/domain/client tests and eight worker/build tests. pnpm build passed and generated the static export with 69 public shell assets.

The full production browser suite passed 93 checks across Chromium, Firefox, WebKit, Android emulation and iPhone emulation. Two desktop-only geometry checks were deliberately skipped on mobile. A subsequent focused run passed all 20 structural-delivery checks, including an existing task's native State edit, in all five browser projects.

Unit fixtures cover mapping descendants and drafts, later queued parent dependencies, missing creation receipts across restart, schema rejection, child-first deletion, changed and unreviewed targets, a changed-again review snapshot, receipt corruption, local-only cancellation, disk failures and partial detachment. The browser tests caught and verified the stale Save-success message fix.

All task content, tokens and backend responses in tests are synthetic. No production cloud queue, original desktop data or credentials were used. The earlier adapter checkpoint is historical in CLOUD-DELIVERY.md.

## Review

What this change does: Extends the journaled queue to creation, reviewed deletion lists, parent links and native State. Ambiguous requests stop for readback and explicit review.

Looks good. Ship the adapter checkpoint. Reviewed storage transactions, ID mapping, queued dependencies, mutation ordering, stale-window protection and recovery paths for one personal workspace. The concurrency and metadata limits above remain.

Not checked: live permission/CORS acceptance, production workflows, desktop assigned-status migration, real devices and large-workspace capacity. No deployment was performed.
