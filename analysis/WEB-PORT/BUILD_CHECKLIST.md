# Web port build checklist

Live application: `beab9b784500b16b23f54de99592019830945803`; Vercel `dpl_3cXZEbd1HvTnjE6GNDSbcqftgDGs`, Ready at https://romdex-web.vercel.app. Evidence checkpoint: `6aa159c2f405f491da57014beac0a05a637ee563`. Reconciled October 26, 2026 (America/New_York).

[Working queue](WORKING_QUEUE.md) | [Build](BUILD_CHECKLIST.md) | [QA](QA_CHECKLIST.md) | [Repair](REPAIR_CHECKLIST.md) | [Full acceptance inventory](../../docs/PORT-ACCEPTANCE.md)

Remaining: **18 unchecked actions**, 9 checked evidence-backed actions. Counts describe this report, not percent complete or an estimate.

Current task: reconcile the port status and evidence. Next implementation: SC-001 shared-status design, once a supported approach and any changed contract are agreed. No implementation is performed by this reporting task.

## Implemented

- [x] B01 React task shell, hierarchy navigation, split panes, search, completion visibility and status/priority/complexity/assignee filters. Workspace-menu and pane repairs are deployed. Full interaction parity remains separate below. Evidence: [UI repair](../../docs/UI-REPAIR-2026-10-24.md), [filter behavior](../../docs/TASK-FILTERS.md).
- [x] B02 Durable local tasks, notes and drafts, local revision protection, offline recovery, queue journals and explicit Save. Automatic note delivery waits for editing to finish. Evidence: [notes correction](../../docs/NOTES-SYNC-CORRECTION.md), [task delivery](../../docs/STRUCTURAL-DELIVERY.md).
- [x] B03 Implemented direct YouTrack read/edit/comment/create/delete/reparent adapters with uncertain-result review and no automatic resend. This is implementation and synthetic evidence; complete native workflow acceptance is Q10-Q15. Evidence: [structural delivery](../../docs/STRUCTURAL-DELIVERY.md).
- [x] B04 Assigned/effective status rules preserve parent choices, testing-child precedence, and inherited Standby only for at least two all-Standby children. The red label is Debugging; native Critical / Debugging is unchanged. Concurrent shared storage is explicitly not passed. Evidence: [status delivery](../../docs/STATUS-DELIVERY.md), [label delivery](../../docs/DEBUGGING-LABEL.md).
- [x] B05 Attachment listing, staged durable bytes, explicit upload, verified download, reviewed deletion and uncertain-result recovery are implemented. Native Chrome/Firefox happy paths and exact interrupted recovery passed on private PMON fixtures. Evidence: [attachment acceptance](../../docs/NATIVE-ATTACHMENT-ACCEPTANCE-2026-10-25.md).
- [x] B06 Desktop exporter and reviewed browser import preserve approved source bytes and archive original pending actions without replay; delivery disconnects on import. Recovery export/import and failed-save draft capture exist. Actual owner cutover is pending. Evidence: [desktop migration](../../docs/DESKTOP-MIGRATION.md).
- [x] B07 NPCDex map/content browsing, gender/timeline navigation, separate proposal drafts, stale-source guards and recovery are implemented. These are not full authoring or content-cloud parity. Evidence: [desktop migration](../../docs/DESKTOP-MIGRATION.md).
- [x] B08 Local RDX validation, preview, stable-identity conflict choices, library persistence and import/export exist. Live plan publication is not implemented. Evidence: [full acceptance](../../docs/PORT-ACCEPTANCE.md).
- [x] B09 Vercel static hosting, scoped GitHub auto-deployment, exact-origin CORS, worker/cache protections and explicit update controls are established. Debugging is installed on desktop and deployed to web. Evidence: [task-first migration](../../docs/TASK-FIRST-MIGRATION.md), [label delivery](../../docs/DEBUGGING-LABEL.md).

## Needed for first PMON cutover

- [ ] B10 BLOCKED: choose a safe shared assigned-status contract and storage approach following JetBrains ticket 9288924. The current extension-property read/check/write cannot meet the required concurrency guarantee. Preserve separate parent assignment, exact receipts and offline recovery. See [support reply](../../docs/JETBRAINS-SUPPORT-REPLY-2026-10-26.md).
- [ ] B11 NOT STARTED: implement the agreed protocol and versioned migration in the app/client, retaining old metadata, recovery records and queued intents. Consolidate the candidate before any production installation. Depends on B10; native safety proof is Q09.

## Full accepted-desktop parity after the task-first move

These remain in scope, but the owner allowed NPCDex/RDX authoring to remain in the desktop fallback for the first PMON move. Implement only accepted-client behavior; unshipped source prototypes are not automatically baseline requirements.

- [ ] B12 Load and display the full remote comment history with pagination; the current UI can say "Some remote comments have not been downloaded yet."
- [ ] B13 Add Assignee editing with correct existing account/value preservation; imported assignees and filtering already work.
- [ ] B14 Add Due Date editing and clearing.
- [ ] B15 Add tag editing with existing-value preservation.
- [ ] B16 Add typed custom-property editors and validation for supported fields.
- [ ] B17 Complete multi-selection actions and selection persistence.
- [ ] B18 Complete grouping actions and their review/recovery behavior.
- [ ] B19 Complete tree drag/reparent/order gestures with keyboard alternatives; current parent picker and sibling-order buttons are implemented.
- [ ] B20 Complete NPCDex current-content/map/dialogue corrections and authoring while keeping proposals separate from accepted content.
- [ ] B21 Complete character/catalog identity and planned additions.
- [ ] B22 Complete proposal review/application, annotation/testing views, reversal and full history controls.
- [ ] B23 Complete YouTrack-only content/organization storage, two-way sync and conflict review replacing legacy runtime GitHub providers. Its concurrency design must account for the vendor findings too.
- [ ] B24 Complete managed RDX plan editing, task placement/field mapping, reviewed deletion/attachment requests, two-way reconciliation and YouTrack bindings.
- [ ] B25 Complete accepted fixed-package/task bindings, agent handoff/returned-result review and human testing gates; keep unshipped features explicitly separate.
- [ ] B26 Complete independent provider synchronization so a content failure does not block healthy task work, and shared Save remains one manual cycle when Auto-Sync is Off.
- [ ] B27 Reconcile remaining browser file-open/drop/export and lifecycle equivalents against the accepted desktop baseline. Document session-only sign-in and suspension limits; do not promise desktop file association or continuous tray/background execution.

## Verification boundary

Main Agent inspected the existing UI inventory and evidence, without changing app code. No subagent or repeated test run was needed for this documentation reconciliation. The code backing native attachment acceptance differs from the live app only in three red-label presentation files under src; transport, persistence, worker template, backend and dependencies are unchanged. The exact preservation check is recorded in QA. Current next action is B10, not another administrator ZIP.

Side-pane request: open_in_codex returned queued on October 26; this report was not confirmed visible.
