# Full-port acceptance checklist

## Current status - October 26, 2026

The task-first web app is hosted at https://romdex-web.vercel.app on application commit `beab9b784500b16b23f54de99592019830945803`. Hosting, exact-origin CORS, native Chrome/Firefox attachment acceptance and the Debugging display-label update are complete within their recorded scopes. The owner's desktop workspace has not been migrated. Desktop data remains the fallback; targeted owner-approved desktop fixes were installed with verified backups.

JetBrains ticket 9288924 confirms that the current shared-status extension-property mechanism has no supported concurrency protection or fix. SC-001 is a design blocker, not an administrator-permission or installation blocker. Production sharing stays withheld. See [the October 26 response](JETBRAINS-SUPPORT-REPLY-2026-10-26.md).

The remaining first-cutover gates are a safe shared-status design and native proof, remaining native task/notes/hierarchy/status delivery checks on private disposable fixtures, actual Windows Chrome/Firefox app installation/lifecycle, and a fresh reviewed desktop export/import with explicit pending-work reconciliation and owner acceptance. NPCDex/RDX authoring and advanced task controls remain full-port work after the first PMON move.

Current phase reports: [Build](../analysis/WEB-PORT/BUILD_CHECKLIST.md), [QA](../analysis/WEB-PORT/QA_CHECKLIST.md), [Repair](../analysis/WEB-PORT/REPAIR_CHECKLIST.md), [working queue](../analysis/WEB-PORT/WORKING_QUEUE.md). Their evidence dates and candidate identities supersede stale current-state statements in older milestone sections below. No new admin installation is requested.

This checklist reconciles the complete migration handoff with the owner's later instructions. PASSKEY and the later full-port request authorize the port; the old handoff's foundation-only restriction is historical. The user selected PMON for current tasks and NPCD-872/873 for metadata acceptance, then additionally authorized disposable tasks beneath private test-only PMON Epic PMON-466 (current attachment children PMON-467/468). Existing production work is not a test target. MCP is preferred; app administration is checked in the browser because the connector has no app-administration tool.

A code check, synthetic browser result, live read and human acceptance are different evidence. An unchecked row is unfinished or still needs its stated acceptance. Passing a subset does not close the full port.

## Preservation and architecture

- [x] Keep development in the separate private ROMDex-Web repository. Current branch: codex/accepted-app-port. The template push URL stays DISABLED. Private visibility was verified through GitHub MCP before publication.
- [x] Preserve desktop data/credentials and the fallback. Owner-approved source-only desktop repairs have full verified backups; the October 26 label update preserved all 134 profile files byte for byte. Earlier RDX read-only hashes are historical evidence, not a new live-data audit.
- [x] Use React controls and accepted shared UI assets. No legacy renderer, iframe, custom application server, proxy, Server Actions or runtime GitHub data backend is introduced. Static export remains configured.
- [x] Pin added browser hash/byte dependencies without a general dependency upgrade. package.json and the lockfile add only @noble/hashes 2.4.0 and buffer 6.0.3; accepted modules have provenance.
- [ ] Accept complete visual and keyboard parity against the installed client. Current task shell and initial NPCDex controls are implemented; complete appearance and interaction acceptance remains pending.
- [ ] Perform a fresh full desktop backup, reviewed export and actual cutover after the remaining features and live checks are ready. No live workspace import has been applied as a test.

## Task workspace and delivery

- [x] Durable tasks, title/comment drafts, selected task, scope, search, expanded trees and split-pane mode. Evidence: workspace unit tests and task-port browser tests, including offline reopening and stale-window rejection.
- [x] Creation remaps local IDs and descendants; explicit exact-ID recovery prevents duplicate POST. Evidence: structural-delivery tests.
- [x] Reparenting rejects cycles and preserves detached-link recovery. Evidence: workspace, hierarchy and structural-delivery tests.
- [x] Sibling up/down ordering is local, durable and limited to siblings. Evidence: task-layout unit test; complete drag behavior is still open below.
- [ ] Local raster task images have type, size and dimension checks. Creation remaps their IDs and refuses an existing different image. Evidence: accepted image bounds and task-layout tests. Actual image-picker visual acceptance is pending.
- [x] Notes save locally while focused and automatic task delivery waits until editing ends. Explicit Save is available; own in-flight revisions retain their baseline and genuine external changes still require review. See NOTES-SYNC-CORRECTION.md for installed-code evidence and the final browser run.
- [x] Notes and queued comments preserve their original task/draft scope. Evidence: workspace and task-port tests.
- [ ] Download complete remote comments on demand and accept their pagination/display. The UI currently says `Some remote comments have not been downloaded yet.` where applicable.
- [x] Priority and complexity use current PMON choices and preserve unknown read values. Evidence: live MCP schema read and PMON status browser scenario.
- [ ] Complete Assignee, Due Date, tags, typed custom properties, grouping and multi-select parity.
- [ ] Complete tree drag/order gestures and their keyboard alternatives.
- [x] Attachment list/download, durable upload, exact receipt/hash recovery, reviewed deletion and staged-byte recovery transfer are implemented. Native Chrome/Firefox happy paths and interrupted Firefox recovery passed on private PMON fixtures; additional native error branches retain only their stated synthetic coverage. See NATIVE-ATTACHMENT-ACCEPTANCE-2026-10-25.md.
- [x] Deletion displays the exact task/descendant list. `Queue deletion of listed tasks?` leads to ` Delete Listed Items`; Cancel preserves work. Evidence: delete-review source, structural-delivery tests and explicit missing/access recovery.
- [x] Default Auto-Sync is Off. `Save Changes` performs a manual task delivery cycle and leaves that preference unchanged. Evidence: delivery browser tests.
- [x] Session tokens remain in memory and authenticated/private traffic bypasses shell caching. Evidence: task-port, delivery and worker tests.
- [x] Interrupted requests preserve an attempting/uncertain marker before mutation; automatic delivery stops. `Read back and confirm; do not resend` uses current readback. Evidence: delivery-review and structural-delivery browser tests.
- [ ] Verify live task delivery permissions, workflows, throttling and latency using only the authorized synthetic fixtures, then obtain production cutover acceptance.
- [ ] Finish independent provider synchronization so one failed content provider does not stop healthy task work or vice versa. Task delivery is currently implemented; content delivery is not.

## Status corrections requested by the owner

- [x] Standby is inherited only when at least two immediate children are all effectively Standby. Exactly one Standby child and mixed Done/Standby children produce In Progress. A leaf retains its own assignment. Recursive calculations use each immediate child's effective status. Own assignments remain intact. Installed desktop correction and normal sync are verified. Native YouTrack app acceptance remains pending. Current evidence is STANDBY-METADATA-REPAIR.md; STATUS-CORRECTION.md records the superseded October 22 rule.

- [x] Picker order remains To do, In Progress, Standby, In Development, Awaiting Testing, Done, Debugging. The red display label is Debugging while its native value remains Critical / Debugging. Amber follows development and respects reduced motion. Evidence: task-port checks and DEBUGGING-LABEL.md.
- [x] Map displayed Awaiting Testing to native PMON Needs Testing. Never create or rename a State bundle value to make a test pass. Evidence: issue-body tests, PMON MCP schema and status-delivery browser tests.
- [x] Any testing child gives its parent amber precedence, recursively through ancestors, while retaining the parent's own assignment. Evidence: core combinations, rollup tests and status-delivery/shared-status browser scenarios.
- [x] Shared-status preview, revision comparisons, exact receipt review and unavailable-storage refusal are implemented and covered synthetically. This row passes client mechanics only: the native simultaneous-write failure invalidates the server isolation assumption, so safe shared delivery remains blocked.
- [x] Acceptance app was updated in place to 1.0.12, ID 155-84, Active on NPCD only (last native inspection October 24). Handler/serial receipt/fresh-page and rollback checks passed within their detailed scope. See LIVE-ACCEPTANCE-2026-10-24.md.
- [ ] Resolve SC-001 simultaneous-write loss through an approved safe design and native proof. JetBrains confirmed the unsupported concurrency guarantee on October 26; another install alone is insufficient.
- [ ] Install/enable the accepted production metadata app only after isolated acceptance. Production sharing stays off.
- [ ] Verify cross-device behavior on actual separate devices. Independent synthetic browser stores are not physical-device acceptance.

## NPCDex and portable files

- [x] Read maps, areas, encounters, points and dialogue blocks in React, filtered by player gender with timeline context, registry and source history. Evidence: desktop-migration browser tests and NPCDex unit tests.
- [x] Preserve map/encounter selection, gender and stage on reload and preserve drafts when switching workspace. Evidence: desktop-migration browser scenario and editor flush integration.
- [x] Notes, flags, intent, instructions and proposed dialogue stay separate from current content and testing evidence. Stale revisions/targets refuse a save. Evidence: NPCDex unit tests and actual proposed-dialogue Save/Reload browser path.
- [ ] Complete current-content documentation corrections, shared/local character identity, planned additions, proposal workflows, annotation/testing views, reversal and full history controls.
- [ ] Complete YouTrack-only content storage, incoming/outgoing synchronization, conflict review and replacement of former GitHub metadata providers.
- [x] Validate modern RDX framing, schemas, digests, assets, graph/history references and limits in a cancellable worker. Reject trailing compressed data and unknown required capabilities. Evidence: RDX unit tests and native golden files.
- [x] Preview map/plan merges using stable identity/ancestry and explicit visible local/incoming choices. Stale local heads refuse saving. Source bytes and imported document history remain recoverable. Evidence: RDX library unit tests and the browser conflict scenario showing both versions, the disabled-save default, explicit choice and exported selected value.
- [x] Retain/export RDX files byte-for-byte across browser reload. Evidence: RDX browser scenario across the configured browser matrix.
- [x] Project native and record-based maps while treating imported testing claims as unreviewed. Agent-result files cannot replace current map content. Evidence: inspect path, RDX fixtures and read-only audit of all three current desktop RDX files.
- [ ] Complete managed plan editing, reviewed native task placement/field mapping, deletion requests, attachments, two-way reconciliation and YouTrack RDX bindings.
- [ ] Complete fixed packages, task/package bindings, agent handoffs, returned-result review and human testing gates that belong to the accepted client. Unshipped source work must be tracked separately from baseline parity.
- [ ] Accept browser file drop/open/export equivalents and lifecycle behavior. Do not claim desktop file association, tray execution or continuous browser background execution.

## Migration, recovery and messages

- [x] Export only approved desktop files while closed, refuse an existing output, verify exact bytes and retain queued actions/files without replay. Evidence: exporter synthetic test, including credential exclusion, live-owner guard, RDX files and queued bytes.
- [x] Reject corrupted/duplicate/unsafe JSON or unapproved files before replacing a workspace. Evidence: desktop-migration unit tests and the corrupted-file, invalid-layout and spoofed-link browser paths.
- [x] Preview task/map/pending-action counts and assigned conflicts. `Import Reviewed Data` remains unavailable until the recovery-copy/import-choice acknowledgment is checked. Evidence: migration component and browser import path.
- [x] Successful selection displays `File verified locally. No cloud request was made.` Actual import disconnects delivery and leaves Auto-Sync Off. Evidence: desktop-migration browser path, connection/session integration and unit state assertions.
- [x] Recovery restores uncertainty markers and replaces optional fields completely. Evidence: recovery/import validation and stale-preview guard; additional user-observed recovery acceptance is pending.
- [x] Recovery export stays available from memory after local I/O failure and captures dirty editor text. Evidence: aborted-transaction browser path and failed-editor recovery unit test.
- [x] Captured editor restoration requires explicit action and unchanged content revision; original snapshot stays retained. Evidence: the browser recovery scenario restores through the actual button, then imports a changed revision and verifies the displayed refusal across all five targets.
- [x] Actual root messages select dirty/saving/error states: `Unsaved NPCDex draft`, ` Saving in this browser…`, ` Local save needs attention` and ` All changes saved in this browser`. Evidence: workspace-status selection, migration Save/Reload and storage-failure browser paths. No claim that browser-only drafts are cloud-shared.
- [x] RDX success displays `RDX verified locally. No YouTrack changes were queued.` Save requires review acknowledgment. Invalid input offers no Save RDX in Browser action. Evidence: actual RDX browser paths.
- [ ] Verify every remaining task/content failure message through the completed UI paths, including disconnected service, quota, permission, stale baseline and partial progress. Internal packets alone do not close message acceptance.

## PWA and final delivery

- [x] Production-only worker, complete content-hashed precache, offline shell, explicit `Reload to update`, other-window protection and unrelated-cache preservation. Evidence: foundation, worker and update browser tests.
- [x] Draft flush/save failure prevents update activation; update refusal releases its lock. Evidence: workspace/NPCDex units and task-update browser scenario.
- [x] Vercel account/team PMON and root origin https://romdex-web.vercel.app are established; the owner approved access only to GenericCola/ROMDex-Web.
- [x] Static hosting/headers, exact-origin CORS and native authenticated task/attachment requests are verified at their recorded checkpoints. No proxy is used. Hosted source is now beab9b7; preserved-evidence limits are in QA_CHECKLIST.md.
- [ ] Verify actual Windows Chrome and Firefox app installation, OS launch and lifecycle. This is distinct from browser engine or emulated standalone acceptance.
- [ ] Accept real iPhone/iPad installation, storage quota, offline reopening, suspension and update behavior. WebKit/iPhone emulation is automated browser evidence only.
- [ ] Run final complete checks, publish the private checkpoint, provide the tested build and a concise manual acceptance list, then accept cutover. Current test counts and live blockers are recorded in DESKTOP-MIGRATION.md and LIVE-ACCEPTANCE.md.

Migration/RDX checkpoint 47a7df8 verification: pnpm check passed type checking, zero-warning lint, 116 unit tests and eight worker/build checks. pnpm build passed. The complete frozen browser run passed 173 checks with two expected mobile desktop-layout skips. The independent desktop reader accepted browser-repacked synthetic map/plan files. These results close only the verified rows above; production migration, remaining feature implementation and human/device acceptance stay open.

Standby correction verification: current worktree pnpm check passed (126 unit tests, eight worker/build checks), pnpm build passed, and the frozen browser matrix passed 183 checks with two expected mobile layout skips. The status-only checkpoint leaves attachment work uncommitted. Desktop code was backed up and all 131 data-file hashes stayed unchanged. See STATUS-CORRECTION.md for each requirement, package checksums and pending human/live acceptance.

Notes repair verification: pnpm check passed (128 current-worktree unit tests and eight worker/build checks), pnpm build passed, and the final frozen browser matrix passed 198 tests with two expected mobile layout skips. Six installed-desktop engine/bridge checks and four installed-shell UI scenarios passed with fictional I/O. Desktop data hashes matched before/after each update; prior conflicts stay preserved. Owner-observed desktop use and live acceptance remain pending. See NOTES-SYNC-CORRECTION.md.

October 23 current correction: pnpm check passed 132 unit tests plus eight worker/build checks, build passed, and the complete browser matrix passed 198 checks with two expected mobile layout skips (7.0 minutes). Installed desktop normal sync reports all services Up to Date with zero pending. See STANDBY-METADATA-REPAIR.md for complete requirements, cloud receipts and pending native app acceptance. Earlier result counts above are historical.
