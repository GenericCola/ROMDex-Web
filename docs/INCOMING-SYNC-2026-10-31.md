# Incoming sync and understandable conflict recovery

> Superseded 2026-11-07 for timing: incoming sync no longer polls. It reads on
> connect, focus, visibility, online, after delivery and on Refresh. See
> [SYNC-WITHOUT-POLLING.md](SYNC-WITHOUT-POLLING.md). The fencing rules below still hold.

## Root cause

The web workspace mounted only an outgoing scheduler. Existing saved workspaces
were not reread on reopen, and the shared-status refresh returned immediately when
shared statuses were disabled. An external YouTrack change could therefore remain
invisible until an outgoing field-level preflight found a different value.

## Changes

- A visible connected workspace checks the ten latest task IDs/revisions every
  three seconds. This is polling, not a WebSocket push service. Unchanged checks
  do not download full task bodies. Connection/focus requests are coalesced; a
  full snapshot is read on changes and at least every sixty seconds while active.
- Hidden pages do not poll. Failures back off to fifteen, thirty and sixty seconds
  and show a nonblocking notice. Recovery mode prohibits incoming network reads.
- Session, account, project, workspace generation and delivery epoch fence every
  read/apply. Old account responses and older/equal task revisions cannot replace
  newer local baselines. No incoming read creates operations or status rollups.
- Draft/composition/editor and pending/journal locks hold only affected tickets
  and structural dependencies. Other tickets still refresh. Clearing a hold
  schedules a cached reread/apply within 250 ms. Queued ticket baselines stay held
  because the existing editor coalesces new fields into the operation's original
  base. Outgoing reconciliation continues to accept disjoint fields and equal
  values, but preserves genuine unseen same-field competition for review.
- Status and item-editor entry read the current ticket before presenting choices.
  A read failure is shown rather than silently claiming a fresh baseline.
- Full-list omissions are not proof of deletion or lost access: existing tasks
  and cached comments are retained. Remote deletion reconciliation is not guessed.
- A direct Review sync problems action opens Connection Details. Cards show the
  affected ticket, proposed fields, saved local/YouTrack comparison, readable
  native values when evidence supports them, and consequences of each choice.
  Unknown IDs remain explicit. Raw JSON is optional and below the controls.
- Retry is explicit and single-flight, unavailable while any conflict/unknown
  journal remains. Review does not resend uncertain writes. Existing conflicts
  are not automatically discarded or resolved on the user's behalf.

## Preservation and verification

No permissions, credentials, hosting configuration or upstream mutation protocol
changed. Incoming commits preserve operation bases, journal, drafts, files, local
order and upload bytes. Tools retains exactly its three existing actions; project
selection remains in the heading.

Synthetic tests cover merge boundaries, newer/older/equal snapshots, session and
workspace switches, simultaneous requests, hidden/resume/backoff, active editing,
pending files/deletion and explicit conflict choices. Browser evidence uses
synthetic transport only; no real user queues or tickets are used as fixtures.

Protocol reference: JetBrains' Issues REST resource documents the millisecond
`updated` field, `fields`/`$top` list selection and `sort by: updated desc`:
https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues.html
