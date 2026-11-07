# Accepted application port

Authorized by user PASSKEY on October 22, 2026. Port the current accepted ROMDex app to web before adding remaining features. Keep the desktop application, data, credentials and migration archive intact as the fallback.

## Baseline

The migration archive's installed-source is the accepted 0.5.15 client with October 22 synchronization repairs. The project snapshot contains newer development that was not all shipped. MAPDex and RI03C are retired. The accepted source was extracted separately to C:\Users\mrgen\ROMDex-Desktop-Reference and 790 source/reference files matched the supplied SHA-256 manifest. No appdata, credentials or installers were extracted.

Browser-compatible domain rules can be reused with provenance. Renderers must be React; no legacy HTML renderer or iframe wrapper. The first reused modules are public/core.mjs and its pure plan-queue.mjs dependency, for hierarchy, rollups, operation materialization and conflict contracts. Shared Poké Ball/settings SVGs are original UI assets. Never copy source examples, real content or saved maps into public web fixtures.

The "ROMDex data" article is the decided home for assigned status, and the store is described in YOUTRACK-STORAGE.md. SHARED-STATUS.md is the earlier app-based design. The earlier browser-only status checkpoint is in STATUS-DELIVERY.md. Task creation, deletion and hierarchy delivery are documented in STRUCTURAL-DELIVERY.md. The earlier existing-task adapter checkpoint is in CLOUD-DELIVERY.md. The checklist below tracks full accepted-app parity.

## Web status extension

At the user's request, Awaiting Testing follows In Development in the status picker and displays a flashing amber light. Reduced-motion mode uses steady amber. The current web core and app source give testing children precedence over every other sibling status, through all ancestor levels, matching the owner's subsequent desktop requirement. ROMDex displays Awaiting Testing and uses PMON's existing Needs Testing State for native writes. The immutable desktop reference and saved data remain intact. See PMON-DEVELOPMENT.md for the current compatibility checkpoint.

Verified on October 22, 2026: pnpm check passed 88 unit tests and 8 worker/build checks; pnpm build passed. The browser suite passed 123 tests with two expected mobile desktop-layout skips. The status order, flashing light, reload persistence and steady reduced-motion fallback passed across all five browser targets. Reviewed the web/server color rules and unfinished parent rollups. No live cloud change was made; live acceptance of the new State remains pending.

## Delivery checklist

- [ ] React shared shell and task workflow with accepted appearance and keyboard behavior.
- [ ] Durable browser tasks, drafts, queue and multi-window conflict protection.
- [ ] Direct YouTrack authentication, task reads and safe sync with uncertain-operation recovery.
- [ ] Selector/tree drag, reparent, grouping, multi-select and properties/attachments parity.
- [ ] NPCDex maps, entities, dialogue, timelines, proposals, annotations and history.
- [x] YouTrack content backend and metadata replacement for legacy GitHub providers.
      Vercel preview of the branch is pending owner question A1 (PMON-608).
  - [x] Store module and article routes (PMON-571), see YOUTRACK-STORAGE.md.
  - [x] NPCDex and ROMDex metadata sync with conflict review (PMON-572); live
        round trip passed in test articles in TST.
  - [x] Migration from ROMDex-Data (PMON-573) and cutover (PMON-574) on
        2026-11-07, see CUTOVER-2026-11-07.md.
  - [x] Browser acceptance (PMON-575), see ACCEPTANCE-YOUTRACK-STORE.md: the
        store specs pass on chromium, firefox and mobile-chromium with a fake
        YouTrack, and a read-only Node check of PMON-A-3 and NPCD-A-1 matches
        the cutover hashes. No browser has run against live YouTrack yet.
- [ ] RDX import/export, managed-container browser equivalents and human testing gates.
- [ ] Previewed desktop-data import with preservation and acceptance checks.
- [ ] Full parity checks, real-device PWA and HTTPS deployment acceptance.

Each milestone records fixture tests separately from live checks. Do not enable production writes or import desktop saves as an incidental test. Keep tokens in memory initially. Browser credential persistence requires a separate explicit design. App-shell Cache Storage must never include workspace data or credentials. Any editable workflow must durably save before worker activation.

## Migration and RDX implementation checkpoint

See DESKTOP-MIGRATION.md for the reviewed desktop/recovery importer, separate NPCDex planning journal, persistent map navigation, local task image/order controls and browser RDX validation/merge/export. The full checklist above remains open until authoring, attachment/property parity, cloud content synchronization, live acceptance and hosting are complete. Desktop data has not been migrated as an incidental test.

The explicit behavior/default/message/exception checklist and its separate automated, live and human acceptance evidence are in PORT-ACCEPTANCE.md. A passing subset does not close the port.
