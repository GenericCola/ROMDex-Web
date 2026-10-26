# Accepted application port

## Current status - October 26, 2026

The task-first web app is hosted at https://romdex-web.vercel.app on application commit `beab9b784500b16b23f54de99592019830945803`. Hosting, exact-origin CORS, native Chrome/Firefox attachment acceptance and the Debugging display-label update are complete within their recorded scopes. The owner's desktop workspace has not been migrated. Desktop data remains the fallback; targeted owner-approved desktop fixes were installed with verified backups.

JetBrains ticket 9288924 confirms that the current shared-status extension-property mechanism has no supported concurrency protection or fix. SC-001 is a design blocker, not an administrator-permission or installation blocker. Production sharing stays withheld. See [the October 26 response](JETBRAINS-SUPPORT-REPLY-2026-10-26.md).

The remaining first-cutover gates are a safe shared-status design and native proof, remaining native task/notes/hierarchy/status delivery checks on private disposable fixtures, actual Windows Chrome/Firefox app installation/lifecycle, and a fresh reviewed desktop export/import with explicit pending-work reconciliation and owner acceptance. NPCDex/RDX authoring and advanced task controls remain full-port work after the first PMON move.

Current phase reports: [Build](../analysis/WEB-PORT/BUILD_CHECKLIST.md), [QA](../analysis/WEB-PORT/QA_CHECKLIST.md), [Repair](../analysis/WEB-PORT/REPAIR_CHECKLIST.md), [working queue](../analysis/WEB-PORT/WORKING_QUEUE.md). Their evidence dates and candidate identities supersede stale current-state statements in older milestone sections below. No new admin installation is requested.

Authorized by user PASSKEY on October 22, 2026. Port the current accepted ROMDex app to web before adding remaining features. Keep the desktop application, data, credentials and migration archive intact as the fallback.

## Baseline

The migration archive's installed-source is the accepted 0.5.15 client with October 22 synchronization repairs. The project snapshot contains newer development that was not all shipped. MAPDex and RI03C are retired. The accepted source was extracted separately to C:\Users\mrgen\ROMDex-Desktop-Reference and 790 source/reference files matched the supplied SHA-256 manifest. No appdata, credentials or installers were extracted.

Browser-compatible domain rules can be reused with provenance. Renderers must be React; no legacy HTML renderer or iframe wrapper. The first reused modules are public/core.mjs and its pure plan-queue.mjs dependency, for hierarchy, rollups, operation materialization and conflict contracts. Shared Poké Ball/settings SVGs are original UI assets. Never copy source examples, real content or saved maps into public web fixtures.

YouTrack-backed cross-device assigned status and its installable app are documented in SHARED-STATUS.md. The earlier browser-only status checkpoint is in STATUS-DELIVERY.md. Task creation, deletion and hierarchy delivery are documented in STRUCTURAL-DELIVERY.md. The earlier existing-task adapter checkpoint is in CLOUD-DELIVERY.md. The checklist below tracks full accepted-app parity.

## Web status extension

At the user's request, Awaiting Testing follows In Development in the status picker and displays a flashing amber light. Reduced-motion mode uses steady amber. The current web core and app source give testing children precedence over every other sibling status, through all ancestor levels, matching the owner's subsequent desktop requirement. ROMDex displays Awaiting Testing and uses PMON's existing Needs Testing State for native writes. The immutable desktop reference and saved data remain intact. See PMON-DEVELOPMENT.md for the current compatibility checkpoint.

Verified on October 22, 2026: pnpm check passed 88 unit tests and 8 worker/build checks; pnpm build passed. The browser suite passed 123 tests with two expected mobile desktop-layout skips. The status order, flashing light, reload persistence and steady reduced-motion fallback passed across all five browser targets. Reviewed the web/server color rules and unfinished parent rollups. No live cloud change was made; live acceptance of the new State remains pending.

## Delivery checklist

- [ ] React shared shell and task workflow with accepted appearance and keyboard behavior.
- [ ] Durable browser tasks, drafts, queue and multi-window conflict protection.
- [ ] Direct YouTrack authentication, task reads and safe sync with uncertain-operation recovery.
- [ ] Selector/tree drag, reparent, grouping, multi-select and properties/attachments parity.
- [ ] NPCDex maps, entities, dialogue, timelines, proposals, annotations and history.
- [ ] YouTrack content backend and metadata replacement for legacy GitHub providers.
- [ ] RDX import/export, managed-container browser equivalents and human testing gates.
- [ ] Previewed desktop-data import with preservation and acceptance checks.
- [ ] Full parity checks, real-device PWA and HTTPS deployment acceptance.

Each milestone records fixture tests separately from live checks. Do not enable production writes or import desktop saves as an incidental test. Keep tokens in memory initially. Browser credential persistence requires a separate explicit design. App-shell Cache Storage must never include workspace data or credentials. Any editable workflow must durably save before worker activation.

## Migration and RDX implementation checkpoint

See DESKTOP-MIGRATION.md for the reviewed desktop/recovery importer, separate NPCDex planning journal, persistent map navigation, local task image/order controls and browser RDX validation/merge/export. The full checklist above remains open until authoring, attachment/property parity, cloud content synchronization, live acceptance and hosting are complete. Desktop data has not been migrated as an incidental test.

The explicit behavior/default/message/exception checklist and its separate automated, live and human acceptance evidence are in PORT-ACCEPTANCE.md. A passing subset does not close the port.
