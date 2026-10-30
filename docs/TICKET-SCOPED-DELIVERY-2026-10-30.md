# Ticket-scoped delivery checkpoint — 2026-10-30

Base: published `539c98edfa48ca0755fffcb0afdf7e0eda819b02`. This is an isolated
candidate, not the held broader native-sync/parity branch.

## Behavior

- Delivery no longer makes the entire application inert. Selection, navigation,
  reading, and unrelated ticket edits remain available during network waits.
- Operations in the current sending batch and their actual hierarchy dependencies
  are protected against coalescing, cancellation, and baseline replacement. Merely
  opening a ticket acquires no cross-user lock. Creation followups protect their
  remapped server IDs. Conflict/uncertainty protects the affected tickets.
- New operations committed during a batch remain queued for a subsequent batch.
  Current-state status merges replace stale whole-cloud metadata assignments.
  Rollup plans reject changed inputs before applying or dispatching them.
- Outgoing work is event-driven, debounced by 750 ms after eligible committed
  changes, not a ten-second polling interval. Browser scheduling/network latency
  can lengthen this. Dirty uncommitted editors and IME composition are respected;
  idle focus alone does not suspend outgoing work indefinitely.
- Turning Auto-Sync OFF lets the already-started operation finish confirmation,
  then prevents subsequent automatic operations. Manual Save remains explicit.
  Uncertain results are never automatically retried.
- Unrelated attachment staging/cancellation, deletion, and hierarchy operations
  use ticket/dependency guards. Only exact new cancellation archives for proven
  unsent removed operations may bypass metadata equality; existing journal
  entries, receipts, account binding, and RDX ledger remain protected.
- Comment/file reads crossing a delivery epoch remain transient previews rather
  than overwriting a queued baseline. Account/project switching and recovery
  replacement still wait for active delivery; these are not ordinary navigation.

## Verification

356 unit tests passed on this source, including scheduler races, composition,
held preflight with unrelated edits, creation remap/followup locking, OFF during
rollup planning, safe cancellation archives, and unchanged locked operations.
Independent reviewers examined queue, rollup, StrictMode, expiry and timer edges.

Actual cloud Chromium used the complete AuthGate/workspace with production CSS
and a synthetic fetch implementation that never contacts YouTrack. The original
source made `.romdex-app` inert during a held request. The repaired source let
Alpha remain protected while Beta was selected and edited. Release produced
exactly two synthetic updates across successive batches and an empty queue.
A conflicting Alpha field preserved both versions while Beta remained editable
and both trays usable. Screenshots are retained outside the source package.
This is not physical Android or live multi-user acceptance.

The normal local build encountered an environment network failure retrieving
existing Google Font files. An escalation failed before execution with a bwrap
read-only mount error; no denied path was accessed. Offline verification uses
Next's documented-in-source `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` test mechanism
with the exact retained font bytes from the prior successful build. Production
build configuration is unchanged; Vercel's normal build remains the final gate.

## Deliberate remaining boundaries

An unresolved conflict/uncertain result still pauses automatic remote delivery
until explicit review/Save; it no longer freezes unrelated local editing.
Malformed/unassociated journal evidence fails closed. RDX import, account switch,
cache maintenance, and recovery replacement are not made concurrent with writes.

No shared server editing lease exists; local guards do not lock other users.
Fresh GET / field comparison / POST / readback is not atomic CAS. The reviewed
native issue-update API documents `updated` as read-only and no revision
precondition. SC001 shared-status delivery remains OFF. Idle incoming refresh
and held broader sync changes are not included.

Authentication persistence is unchanged: existing short-lived sessionStorage
record only. The separately approved HttpOnly server-session architecture needs
runtime/store/key and offline-access setup approval before deployment. No token,
new credential, cookie, OAuth grant, permission or live ticket mutation is part
of this checkpoint.

References:
- https://www.jetbrains.com/help/youtrack/devportal/operations-api-issues.html
- https://www.jetbrains.com/help/hub/authorization-code.html
- https://www.jetbrains.com/help/hub/refresh-token.html
