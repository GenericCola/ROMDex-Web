# Desktop migration and portable files

The October 22 port work adds a reviewed desktop import, NPCDex source browsing and planning drafts, and a browser RDX library. The desktop executable, reference source, credentials and original saves have not been changed.

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

Finish task attachment/property and multi-selection parity; complete versioned content authoring and its YouTrack-only synchronization; complete managed plan editing/publication; then run live isolated acceptance. The installed acceptance app still needs an administrator update/activation. Production sharing remains off.

An HTTPS destination and its hosting account are still needed. Deployment must apply public/_headers at a root origin, followed by YouTrack CORS configuration and real-device acceptance. No hosting destination has been selected or deployment performed. Keep using the desktop as the authoritative fallback until a reviewed migration and cutover are accepted.

## Verification

Current code checks pass type checking, zero-warning lint, 116 unit tests and eight worker/build checks. Synthetic tests cover migration integrity, source preservation, stale previews, archive allowlists, closed-owner export guards, draft recovery, task image ID mapping, sibling ordering, golden RDX files produced by the untouched desktop packer and conflicting plan merges. The complete current browser suite passed 173 checks across Chromium, Firefox, WebKit, mobile Chromium and iPhone emulation, with two expected desktop-layout skips on mobile. The untouched desktop reader also accepted browser-repacked synthetic map and plan files with unchanged document revisions and assets. A read-only audit also validated all three current desktop RDX files with 101, 34 and 79 included record revisions; each projected successfully and its source hash stayed unchanged. No live task, comment, attachment or app mutation was used as an acceptance test.

Review: traced file selection, preview, mutation guards, disk failures, unsaved-editor capture, restoration, stale revisions, startup ordering, conflict controls and update locks. Browser-path checks exposed and fixed the startup race, hidden NPCDex recovery controls, save-message precedence, a WebKit editor-registration gap and mobile dialog scroll oscillation. The intended load is one personal workspace; full feature parity, live backend execution, deployed CORS and physical devices remain pending.
