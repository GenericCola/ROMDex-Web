# YouTrack delivery checkpoint

The web port now has optional cloud delivery for existing PMON task titles, notes, priority, complexity and comments. This is the first delivery adapter. Creation, deletion, hierarchy changes, State and Assigned State remain queued and stop the cycle at their position. No operation is silently skipped or discarded.

The original desktop application, desktop saves, credentials, migration archive and source-only reference remain separate and unchanged. Verification uses synthetic responses. No production queue was resumed or cloud record changed as a test.

## Connect and save

Read tasks through Connection Details and review the browser copy. To send browser edits, enter a token under Cloud delivery and choose Enable delivery for this session. The app verifies the current user and binds the queue to that user's ID on the fixed YouTrack tenant. Switching accounts cannot deliver a bound queue.

Save Changes flushes browser storage and runs one serial delivery cycle. It does not enable Auto-Sync. Auto-Sync is initially off; its preference is saved in the browser. When explicitly enabled, it checks every ten seconds while this page is connected. Any failed cycle suspends automatic delivery until a successful manual Save or reconnection. Reconnection still cannot bypass unresolved delivery records.

The delivery token lives only in memory. Closing Connection Details keeps the enabled session; Disconnect delivery or reloading the page discards it. Reloading keeps the queue and Auto-Sync preference, but delivery requires a new connection. The separate task-reader token is cleared after reading. Neither token is stored in IndexedDB, URLs or the shell cache.

## Before and after each request

The coordinator locks queue editing and app updates, flushes pending local writes, and reads the current task. Three-way comparison checks the original baseline, queued fields and current cloud values. Unrelated remote changes are retained; conflicting fields require review. Already-applied edits are acknowledged without another POST.

Before any POST, an IndexedDB transaction durably records that the operation may reach YouTrack. A failed local save prevents that POST. The existing revision check prevents a stale browser window from sending after another window saves first.

An edit is removed from the queue only after the task is read back and its sent fields match. A comment needs a returned comment ID and a successful task readback. Confirmation and queue removal are saved together. Only issue updates and comment creation use POST; there is no field setup, schema mutation, issue creation or deletion.

A timeout, lost response, malformed response, failed readback or interrupted confirmation leaves a review record. A crash with an attempting marker is also treated as uncertain. No uncertain operation is automatically replayed. Comment receipts are kept when received before a later failure.

## Review and recovery

Connection Details shows the pending operation and any conflicting values. Editing remains blocked until review completes.

- Read back and confirm sends no mutation. Edits must match the entire queued patch. Comments require the exact comment ID and matching text on an undeleted comment, never a text-only search.
- Keep my edit rebases a conflicting edit against a fresh read. The next Save compares again before sending. This choice is unavailable for uncertain requests.
- Keep YouTrack archives the original operation in the local journal and removes it from the active queue. The archived change remains in Export Recovery Copy.

If the uncertain result cannot be proved, preserve a recovery copy and inspect YouTrack before archiving it. A missing or unreadable task remains queued. Invalid operation types, duplicate IDs and malformed journals block delivery; existing browser storage is kept. Recovery import and a repair interface are still pending.

## Limits

The REST adapter uses read-before-write and readback; it has no atomic server comparison-and-swap or server idempotency key. Another client can change the same field between the read and POST. Avoid editing the same fields simultaneously in desktop and web. This adapter does not promise exactly-once delivery or complete protection from external concurrent edits.

Priority and complexity require the existing SingleEnumIssueCustomField configuration returned by YouTrack. An unsupported configuration stops delivery. Comment pagination, unsupported mutation adapters, full workspace-format validation, recovery import, real-origin CORS/token acceptance and human testing remain before replacing the desktop fallback.

## Verification

Verified on October 22, 2026 on codex/accepted-app-port. pnpm check passed TypeScript, formatting, zero-warning lint, 27 component/domain/client tests and eight worker/build tests. pnpm build produced the static export and a 69-asset shell inventory.

The full production browser suite passed 73 checks across Chromium, Firefox, WebKit, Android emulation and iPhone emulation. Two desktop-only geometry checks were deliberately skipped in mobile emulation. A subsequent focused run passed all 30 delivery/review cases against the final status-message adjustment.

Fixtures cover durable-before-POST ordering, storage failure, lost responses after acceptance, persisted crash markers, comment receipt recovery, account mismatch, unsupported operations, already-applied edits, conflicting remote edits, both conflict choices, manual Save preserving Auto-Sync off, opted-in automatic delivery pausing after uncertainty, session-token non-persistence, reload/disconnect and editing/update locks. The browser review also caught and fixed Firefox restoring a button's enabled state across reloads.

No live authenticated YouTrack write, production CORS acceptance, real-device installation or deployment was performed. Earlier task-port results remain historical in PORT-STABILIZATION.md.

## Review

What this change does: Adds optional delivery for existing task edits and comments. It preserves ambiguous operations for readback or explicit review.

Looks good. Ship the adapter checkpoint. Reviewed the storage, queue, request and review paths for one user's browser workspace, including stale windows and app updates. External concurrent-edit and unsupported-operation limits are stated above. This checkpoint does not replace the desktop fallback.
