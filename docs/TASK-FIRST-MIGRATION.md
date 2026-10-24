# Task-first web migration

Owner priority, October 24, 2026: PMON tasks, notes, status, hierarchy and
attachments must be ready for the first daily-work cutover. The owner wants an
installed app with its own icon and uses Chrome and Firefox on Windows. NPCDex
and RDX authoring can remain in the preserved desktop fallback until later.
Do not infer permission to drop cross-browser status safety from the install
preference; no reduced-safety cutover choice was approved.

## Required before cutover

- [x] Preserve existing unfinished source work before attachment QA. The
  byte-verified 42-file snapshot has SHA-256
`61b1f2c550a2f1bea96044aea617d85740ba92adf266ce429b1cff4c504c9d4d`.
- [x] Check attachment staging, restart persistence, exact download, explicit
  deletion, lost upload/deletion response review and no automatic resends through
  the rendered Chrome and Firefox UI. All 18 focused attachment/install checks
  passed. These use local API fixtures.
- [x] Respect the tenant's unchanged 10 MiB upload limit. Legacy staged records
  remain recoverable; oversized network uploads stop before a delivery attempt.
  Ten attachment unit checks pass, including exact bytes and token-origin guards.
- [x] Verify new-task creation-ID remapping and attachment-byte recovery transfer
  to a separate browser workspace, with delivery disconnected after import.
- [x] Prepare Vercel static export, equivalent security/service-worker headers,
  root routing and exclusions for private artifacts and credentials. No proxy,
  application server, credentials or billing settings are added.
- [x] Confirm the owner's existing Vercel account is signed in. PMON is the
  selected Vercel account/team. The installed connector exposes no account tools.
- [ ] Finish final complete checks/build/browser matrix and record exact output.
- [ ] Deploy and verify a static shell on Vercel. Private GitHub repository
  import currently has no access; a static-only upload avoids granting repository
  permissions. A hosted shell is a preview, not a completed data migration.
- [ ] Verify real-origin response headers, service worker, HTTPS, routing and
  YouTrack CORS. Confirm native attachment delivery only on the NPCD allowlist.
- [ ] Verify actual Windows installation/launch from Chrome and Firefox. The
  automated standalone test emulates the display-mode signal; it is not OS-level
  installation acceptance. Chrome uses its install prompt/icon; recent Firefox
  Windows uses its address-bar web-app button.
- [ ] Resolve the native shared-status concurrency failure and retest it. No
  browser-local or serverless in-memory lock may be substituted for native proof.
- [ ] Once the safety gates pass, fully quit the desktop, preserve a complete
  backup, create a verified portable export and preview the import. Keep original
  desktop queues/files; never replay them as web requests.
- [ ] Verify source/packages/evidence on the private remote. Keep this branch
  open while migration is incomplete; no cleanup pruning.

## Current findings

Acceptance app 1.0.12 remains restricted to NPCD-872 and NPCD-873. Both child
race requests succeeded at the same revision and only one receipt remained.
Production sharing is OFF and production source 1.0.8 remains withheld. Native
atomic commit/rollback is proven; cross-request serialization is not. A supported
atomic primitive or a conflict-preserving protocol still needs implementation
and actual native concurrency tests.

The desktop remains authoritative and untouched. No live export/import or PMON
mutation has been performed. See [ATTACHMENTS.md](ATTACHMENTS.md) for file-delivery
behavior and [LIVE-ACCEPTANCE-2026-10-24.md](LIVE-ACCEPTANCE-2026-10-24.md) for the
separate native metadata failure.
