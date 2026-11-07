# Full-port acceptance checklist

This checklist reconciles the complete migration handoff with the owner's later instructions. PASSKEY and the later full-port request authorize the port; the old handoff's foundation-only restriction is historical. The user selected PMON for current task development and NPCD for isolated acceptance, then restricted developer mutations to NPCD-872 and NPCD-873. MCP is preferred; app administration is checked in the browser because the connector has no app-administration tool.

A code check, synthetic browser result, live read and human acceptance are different evidence. An unchecked row is unfinished or still needs its stated acceptance. Passing a subset does not close the full port.

## Preservation and architecture

- [x] Keep development in the separate private ROMDex-Web repository. Current branch: codex/accepted-app-port. The template push URL stays DISABLED. Private visibility was verified through GitHub MCP before publication.
- [x] Keep desktop app, data and credentials intact. This checkpoint writes only web-repository and temporary files. Read-only audits re-read hashes of the three current desktop RDX files and found no byte changes.
- [x] Use React controls and accepted shared UI assets. No legacy renderer, iframe, custom application server, proxy, Server Actions or runtime GitHub data backend is introduced. Static export remains configured.
- [x] Pin added browser hash/byte dependencies without a general dependency upgrade. package.json and the lockfile add only @noble/hashes 2.4.0 and buffer 6.0.3; accepted modules have provenance.
- [ ] Accept complete visual and keyboard parity against the installed client. Current task shell and initial NPCDex controls are implemented; complete appearance and interaction acceptance remains pending.
- [ ] Perform a fresh full desktop backup, reviewed export and actual cutover after the remaining features and live checks are ready. No live workspace import has been applied as a test.

## Task workspace and delivery

- [x] Durable tasks, title/comment drafts, selected task, scope, search, expanded trees and split-pane mode. Evidence: workspace unit tests and task-port browser tests, including stale-window rejection. Offline reopening works again (PMON-628, owner answer Q9 in PMON-622): the browser remembers the last signed-in account and PMON project (ids and names only, no token, in localStorage `romdex-offline-account-v1`). When the session request fails with a network error, the app opens that saved workspace for normal local editing with the banner "Offline: changes are saved here and sent when you are back online". Nothing is delivered until a session check succeeds; the app checks again on the browser `online` event and on window focus, never on a timer. A 401 still goes to sign-in, sign-out forgets the account so nothing opens offline afterwards, and a browser with no saved work shows "No saved work in this browser yet". Evidence: `tests/unit/offline-reopen.test.tsx` and the task-port browser test, which drops its fixture routes and goes offline before reloading.
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
- [ ] Complete attachment list, download, durable upload, exact receipt/hash recovery, reviewed deletion and recovery-file transfer of staged bytes.
- [x] Deletion displays the exact task/descendant list. `Queue deletion of listed tasks?` leads to ` Delete Listed Items`; Cancel preserves work. Evidence: delete-review source, structural-delivery tests and explicit missing/access recovery.
- [x] Default Auto-Sync is Off. `Save Changes` performs a manual task delivery cycle and leaves that preference unchanged. Evidence: delivery browser tests.
- [x] Session tokens remain in memory and authenticated/private traffic bypasses shell caching. Evidence: task-port, delivery and worker tests.
- [x] Interrupted requests preserve an attempting/uncertain marker before mutation; automatic delivery stops. `Read back and confirm; do not resend` uses current readback. Evidence: delivery-review and structural-delivery browser tests.
- [ ] Verify live task delivery permissions, workflows, throttling and latency using only the authorized synthetic fixtures, then obtain production cutover acceptance.
- [ ] Finish independent provider synchronization so one failed content provider does not stop healthy task work or vice versa. Task delivery is currently implemented; content delivery is not.

## Status corrections requested by the owner

- [x] Standby is inherited only when at least two immediate children are all effectively Standby. Exactly one Standby child and mixed Done/Standby children produce In Progress. A leaf retains its own assignment. Recursive calculations use each immediate child's effective status. Own assignments remain intact. Installed desktop correction and normal sync are verified. Native YouTrack app acceptance remains pending. Current evidence is STANDBY-METADATA-REPAIR.md; STATUS-CORRECTION.md records the superseded October 22 rule.

- [x] Picker order is To do, In Progress, Standby, In Development, Awaiting Testing, Done, Critical / Debugging. Awaiting Testing displays flashing amber after development. Evidence: task-port browser selection/reload/reduced-motion scenario and accepted core tests.
- [x] Map displayed Awaiting Testing to native PMON Needs Testing. Never create or rename a State bundle value to make a test pass. Evidence: issue-body tests, PMON MCP schema and status-delivery browser tests.
- [x] Any testing child gives its parent amber precedence, recursively through ancestors, while retaining the parent's own assignment. Evidence: core combinations, rollup tests and status-delivery/shared-status browser scenarios.
- [x] Shared assigned metadata requires explicit migration preview, revision checking and exact receipt recovery. Unavailable storage blocks shared delivery without native fallback. Evidence: shared-status tests with two independent browser stores.
- [ ] Activate/update the installed acceptance app and execute live handler, concurrency, rollback and fresh-page tests. Browser inspection still shows version 1.0.1 inactive and the account's Active switch disabled. Current administrator package is version 1.0.4.
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
- [ ] Choose the HTTPS hosting account and root-origin address. A hosting clarification is pending; no destination is invented.
- [ ] Deploy with the actual static-host headers, configure YouTrack CORS for that origin and verify direct requests. No proxy workaround.
- [ ] Accept real iPhone/iPad installation, storage quota, offline reopening, suspension and update behavior. Automated browser tests run on Chromium only (desktop and Pixel 7 emulation) since November 7, so iPhone behavior has no automated evidence.
- [ ] Run final complete checks, publish the private checkpoint, provide the tested build and a concise manual acceptance list, then accept cutover. Current test counts and live blockers are recorded in DESKTOP-MIGRATION.md and LIVE-ACCEPTANCE.md.

Migration/RDX checkpoint 47a7df8 verification: pnpm check passed type checking, zero-warning lint, 116 unit tests and eight worker/build checks. pnpm build passed. The complete frozen browser run passed 173 checks with two expected mobile desktop-layout skips. The independent desktop reader accepted browser-repacked synthetic map/plan files. These results close only the verified rows above; production migration, remaining feature implementation and human/device acceptance stay open.

Standby correction verification: current worktree pnpm check passed (126 unit tests, eight worker/build checks), pnpm build passed, and the frozen browser matrix passed 183 checks with two expected mobile layout skips. The status-only checkpoint leaves attachment work uncommitted. Desktop code was backed up and all 131 data-file hashes stayed unchanged. See STATUS-CORRECTION.md for each requirement, package checksums and pending human/live acceptance.

Notes repair verification: pnpm check passed (128 current-worktree unit tests and eight worker/build checks), pnpm build passed, and the final frozen browser matrix passed 198 tests with two expected mobile layout skips. Six installed-desktop engine/bridge checks and four installed-shell UI scenarios passed with fictional I/O. Desktop data hashes matched before/after each update; prior conflicts stay preserved. Owner-observed desktop use and live acceptance remain pending. See NOTES-SYNC-CORRECTION.md.

October 23 current correction: pnpm check passed 132 unit tests plus eight worker/build checks, build passed, and the complete browser matrix passed 198 checks with two expected mobile layout skips (7.0 minutes). Installed desktop normal sync reports all services Up to Date with zero pending. See STANDBY-METADATA-REPAIR.md for complete requirements, cloud receipts and pending native app acceptance. Earlier result counts above are historical.
