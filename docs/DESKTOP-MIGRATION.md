# Desktop migration and portable files

## Current status - October 26, 2026

The task-first web app is hosted at https://romdex-web.vercel.app on application commit `beab9b784500b16b23f54de99592019830945803`. Hosting, exact-origin CORS, native Chrome/Firefox attachment acceptance and the Debugging display-label update are complete within their recorded scopes. The owner's desktop workspace has not been migrated. Desktop data remains the fallback; targeted owner-approved desktop fixes were installed with verified backups.

JetBrains ticket 9288924 confirms that the current shared-status extension-property mechanism has no supported concurrency protection or fix. SC-001 is a design blocker, not an administrator-permission or installation blocker. Production sharing stays withheld. See [the October 26 response](JETBRAINS-SUPPORT-REPLY-2026-10-26.md).

The remaining first-cutover gates are a safe shared-status design and native proof, remaining native task/notes/hierarchy/status delivery checks on private disposable fixtures, actual Windows Chrome/Firefox app installation/lifecycle, and a fresh reviewed desktop export/import with explicit pending-work reconciliation and owner acceptance. NPCDex/RDX authoring and advanced task controls remain full-port work after the first PMON move.

Current phase reports: [Build](../analysis/WEB-PORT/BUILD_CHECKLIST.md), [QA](../analysis/WEB-PORT/QA_CHECKLIST.md), [Repair](../analysis/WEB-PORT/REPAIR_CHECKLIST.md), [working queue](../analysis/WEB-PORT/WORKING_QUEUE.md). Their evidence dates and candidate identities supersede stale current-state statements in older milestone sections below. No new admin installation is requested.

The October 22 port work added reviewed desktop import, NPCDex browsing/planning drafts and a local RDX library. Later owner-approved desktop source repairs have verified backups; original saves and credentials remain preserved. The owner's workspace has not been transferred to web.

## Export while the desktop is closed

Fully quit ROMDex through its tray menu so its editors and journals are checkpointed. Run this command from the web repository with Node 24:

```powershell
node scripts/export-desktop.mjs "C:\Users\mrgen\AppData\Local\ROMDexDesktop\Data\thegobindsingh-PMON" "<new private export path outside the desktop profile>.json"
```

The exporter refuses a live desktop owner, an existing destination, linked or unexpected entries, changing source bytes, more than 1,000 files or more than 64 MiB of approved source bytes. It verifies each SHA-256 digest before and after writing. The archive contains the task workspace, assigned-status sidecar, current/recovery NPCDex JSON, journal, managed RDX working/previous/recovery files and queued upload metadata/bytes when present. It excludes encrypted credentials, session files and SQLite databases. It is a portable application export; retain the original profile and a separate full backup for database-only recovery history. No export has yet been applied to the owner's live browser workspace.

Choose Import Desktop or Recovery Data in the web app. The preview verifies bytes and shape locally, compares assigned choices against the current browser task baseline, and requires an explicit choice for conflicts. Applying a desktop import retains the preceding browser copy and original approved files in its migration recovery record. Desktop operations and queued files remain archived for review; they do not enter the active web queue. Delivery disconnects and Auto-Sync stays off.

The parser rejects duplicate/reserved object keys, invalid Unicode/UTF-8, excessive depth/count/size and unsafe numbers. Recovery also validates layout/draft fields and rejects task links outside their exact YouTrack issue. An invalid or stale preview cannot replace the browser copy. Recovery imports replace all optional fields as well as required ones and preserve uncertainty markers. A recovery file is local work, not permission to replay requests.

## NPCDex in this checkpoint

React controls browse maps, areas, encounters, points and dialogue blocks, with gender and timeline selection, raster images, the character registry and source history. The map sidebar and saved selection replace the PMON sidebar in NPCDex. Selection, gender and stage survive reload.

Feedback, flags, intent, instructions and proposed dialogue are stored in a separate draft journal pinned to the source revision and stable target IDs. Saving a proposal leaves current content and existing source evidence intact. Each saved draft retains its before/after history. A changed revision or missing target blocks a stale draft save.

Save Changes, workspace switches, imports, recovery export and PWA update preparation flush registered editors first. An editor failure blocks switching or updating. Recovery export remains available from memory after a failed save and captures dirty editor text separately. Imported editor snapshots require explicit restoration against their unchanged source revision.

Current-content corrections, full proposal workflows, character/catalog authoring and cloud delivery of these drafts remain to be ported. The current draft editor does not claim implementation or human testing.

## RDX files

RDX Files uses the accepted fixed-footer dialog with a separately scrolling preview. It reads modern ROMDXR01 containers in a bounded worker with a 30-second deadline and cancellation on close. Accepted framing, schemas, canonical revisions, graph references, history, assets and image dimensions are checked. Limits are 64 MiB stored, 128 MiB decoded and the accepted stricter JSON/object bounds. Raw DEFLATE input after the final block is rejected.

Maps and task plans can be retained, inspected and exported. Earlier container bytes remain in the local library; merged documents retain the exact imported document body in portable history. Existing identities merge through the accepted desktop ancestry/conflict rules. Every overlap needs a visible local/incoming choice. A changed local head blocks a stale save. The browser library has a 64 MiB total bound and never prunes history silently.

Native-view and record-based maps can open as a separate NPCDex workspace. Opening retains the preceding workspace and drafts in recovery history. Imported testing claims display as unreviewed; file validity grants no ownership, implementation or testing authority. Agent-result files cannot replace current map content. Legacy original-save map projection uses the explicit desktop migration flow.

Managed desktop RDX files are available for individual review after desktop import. Invalid recovery containers remain preserved in the original archive. Task plans remain separate from live PMON and cannot be published through this checkpoint. Plan authoring, reviewed native task placement, incoming synchronization and the YouTrack RDX binding workflow remain unfinished.

The browser adapters reuse only pure accepted modules under src/domain/accepted, with source hashes in rdx/browser-provenance.json. The legacy renderer is not included. Two direct pinned dependencies provide accepted synchronous SHA-256 and Buffer semantics: @noble/hashes 2.4.0 and buffer 6.0.3. Schemas are pinned locally and cannot fetch remote definitions.

## Cutover work still required

For the owner-approved first PMON move, finish SC-001 design/implementation/native proof, the remaining native task workflows, Windows installation/lifecycle and reviewed backup/export/import with pending-work reconciliation. Hosting, CORS and bounded native attachments are complete. No admin install is currently requested.

Advanced properties/multi-selection, full NPCDex authoring/content synchronization and managed RDX plan/publication remain later accepted-app parity work. They are not prerequisites newly imposed on the task-first cutover. Keep the desktop fallback until the reviewed migration is accepted.

## Historical October 22 verification

That checkpoint's code checks passed type checking, zero-warning lint, 116 unit tests and eight worker/build checks. Synthetic tests cover migration integrity, source preservation, stale previews, archive allowlists, closed-owner export guards, draft recovery, task image ID mapping, sibling ordering, golden RDX files produced by the untouched desktop packer and conflicting plan merges. The complete current browser suite passed 173 checks across Chromium, Firefox, WebKit, mobile Chromium and iPhone emulation, with two expected desktop-layout skips on mobile. The untouched desktop reader also accepted browser-repacked synthetic map and plan files with unchanged document revisions and assets. A read-only audit also validated all three current desktop RDX files with 101, 34 and 79 included record revisions; each projected successfully and its source hash stayed unchanged. No live task, comment, attachment or app mutation was used as an acceptance test.

Review: traced file selection, preview, mutation guards, disk failures, unsaved-editor capture, restoration, stale revisions, startup ordering, conflict controls and update locks. Browser-path checks exposed and fixed the startup race, hidden NPCDex recovery controls, save-message precedence, a WebKit editor-registration gap and mobile dialog scroll oscillation. The intended load is one personal workspace; full feature parity, live backend execution, deployed CORS and physical devices remain pending.
