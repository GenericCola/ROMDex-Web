# Assigned status and parent rollups

The subsequent web status extension restores Awaiting Testing after In Development, using flashing amber. It now takes precedence whenever any child awaits testing, including through higher ancestors. Native PMON writes use the existing Needs Testing State; see PMON-DEVELOPMENT.md.

This records the browser-only checkpoint at commit 65f541a. Current opt-in YouTrack-backed metadata and its setup are documented in SHARED-STATUS.md.

The Assigned Status control now preserves a task's own choice separately from its effective YouTrack State. A leaf uses its assigned status. A parent uses its children's calculated colors, through the unchanged accepted desktop core. Removing or moving its last child restores the parent's assigned choice.

For example, a parent assigned Standby with a Done child has native State Done and assigned status Standby. Moving that child elsewhere restores State Standby. Creating, deleting or moving children schedules the same calculation for the affected hierarchy.

## Preserving choices

Assigned choices live in the browser workspace's status journal and recovery export. The journal records the last observed native State and timestamp, plus any effective State write awaiting confirmation. A native State change outside a pending browser write becomes a new assignment. A confirmed browser rollup keeps the existing assignment. Older observations are rejected.

Existing browser workspaces seed the journal from their saved assigned status, falling back to native State. A first read in a fresh browser can only seed from native State. No desktop sidecar, saves, credentials or migration data are imported. Cross-device assigned-status storage in YouTrack remains pending. Clearing browser storage loses these choices unless separately preserved; recovery import is still pending.

Assigned-status edits reconcile against fresh native observations. A different external choice causes a conflict and preserves both versions. The selected choice and operation acknowledgement commit together in the browser before any derived write. Old queued state/assignedState aliases are interpreted as assignments. The HTTP payload builder rejects direct assignedState delivery.

New tasks are created with their assigned status as initial native State. Their separately journaled parent attachment then schedules parent calculation. No YouTrack fields, state values or project settings are created.

## Calculation and delivery

The current precedence starts with any Awaiting Testing child, then Critical, then In Development; all untouched children produce To do, any remaining untouched or In Progress child produces In Progress, then Standby, otherwise Done. A parent's own choice stays saved while children determine its effective status.

A durable pending-rollup flag survives even when the user queue is empty. Save Changes and opted-in Auto-Sync process this work. The Save lamp stays red while it remains. A failed cycle suspends automatic delivery. Reconnecting or a successful explicit Save can resume it after any required review. Reload requires reconnecting the session token and preserves the sync preference.

Before each calculated write, the adapter reads the full paginated PMON project and validates task IDs, timestamps and hierarchy. Duplicate tasks, missing known tasks, external or unreadable parents, and cycles block rollups. The next target and all its descendants have their paginated child links checked, including leaves, so an unrepresented child blocks that write. Completed earlier operations remain confirmed if a later check fails.

Calculated writes run deepest first, one at a time. Each write gets a durable queue entry. A newly planned entry reuses its checked tree; a resumed entry always reads again and yields if a deeper task now needs calculation. The target's native State, parent and timestamp are checked again before sending.

The pending effective State and attempt marker commit in the same browser transaction before POST. Only native State is sent. Readback must match that State while retaining the assigned choice. The next calculation reads fresh tasks again. An empty final pass clears pending work.

## Interrupted writes and review

An ambiguous calculated write blocks further delivery across reload. Read back and confirm never resends it. Matching the calculated State confirms the write without turning that State into a new assignment. If the user keeps the current YouTrack result, the pending entry is archived and its marker is cleared. The next explicit Save recalculates from fresh tasks. Calculated entries have no manual rebase button because their desired State must come from a fresh hierarchy.

Mixed property/assignment edits use the existing mutation journal. If a property request succeeds but its response is lost, explicit matching readback can finish the saved assignment without repeating the property write. A failed local journal save stops the network request. Multi-window revision checks and delivery/update locks remain in force.

## Limits

This is parity for assigned choices and calculated State within one browser workspace. The desktop app and its data remain the fallback and were not modified. Desktop shared metadata and YouTrack-owned cross-device metadata are separate remaining work.

The REST checks do not provide an atomic conditional write or a transaction across tasks. Another client or workflow can change data after the final read. A native State edit that leaves the value unchanged cannot reveal a new assignment. Avoid simultaneous desktop/web changes to the same tasks. Workflow effects, token permissions and real-origin CORS still need live acceptance. No production writes or deployment were used for verification.

Each rollup pass reads the project and the next contributing subtree. This favors current evidence for one personal workspace. Large-workspace capacity and API throttling have not been measured. API references are in STRUCTURAL-DELIVERY.md.

## Verification

Verified October 22, 2026 on codex/accepted-app-port. pnpm check passed TypeScript, formatting, zero-warning lint, 61 component/domain/client tests and eight worker/build tests. pnpm build passed with 69 public shell assets.

The final full production browser run passed 103 checks across Chromium, Firefox, WebKit, Android emulation and iPhone emulation. Two existing desktop-only geometry checks were skipped on mobile. The first run exposed a test that reloaded before a task-selection save completed; the corrected scenario waits for the visible saved confirmation and checks the reopened task's title as well as its assigned choice.

Seventeen new unit checks cover assignment preservation, every accepted rollup color, creation and last-child changes, native-edit conflicts, legacy aliases, paginated status reads, incomplete hierarchies, stale observations, failed durable markers, mixed-edit recovery, reload and uncertain parent writes. Browser coverage adds ten status scenarios across the five projects. All task content, tokens and backend responses were synthetic; no production queue was resumed.

## Review

What this change does: Preserves assigned choices through parent calculations and sends effective State through the existing durable delivery protocol. Restoring a last-child parent and confirming an interrupted rollup retain the saved choice.

Looks good. Ship the checkpoint. Reviewed assignment observation, durable ordering, queue migration, creation mapping, hierarchy changes, readback review, stale-window protection and pending work after an empty queue for one personal workspace. The resumed-tree selection issue found during review has a regression test.

Not checked: live credentials, production workflows, cross-device metadata, desktop-data import, large-workspace capacity or real-device installation. The desktop fallback was left intact.
