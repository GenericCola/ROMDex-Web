# Task-first web migration

## Current status - October 26, 2026

The task-first web app is hosted at https://romdex-web.vercel.app on application commit `beab9b784500b16b23f54de99592019830945803`. Hosting, exact-origin CORS, native Chrome/Firefox attachment acceptance and the Debugging display-label update are complete within their recorded scopes. The owner's desktop workspace has not been migrated. Desktop data remains the fallback; targeted owner-approved desktop fixes were installed with verified backups.

JetBrains ticket 9288924 confirms that the current shared-status extension-property mechanism has no supported concurrency protection or fix. SC-001 is a design blocker, not an administrator-permission or installation blocker. Production sharing stays withheld. See [the October 26 response](JETBRAINS-SUPPORT-REPLY-2026-10-26.md).

The remaining first-cutover gates are a safe shared-status design and native proof, remaining native task/notes/hierarchy/status delivery checks on private disposable fixtures, actual Windows Chrome/Firefox app installation/lifecycle, and a fresh reviewed desktop export/import with explicit pending-work reconciliation and owner acceptance. NPCDex/RDX authoring and advanced task controls remain full-port work after the first PMON move.

Current phase reports: [Build](../analysis/WEB-PORT/BUILD_CHECKLIST.md), [QA](../analysis/WEB-PORT/QA_CHECKLIST.md), [Repair](../analysis/WEB-PORT/REPAIR_CHECKLIST.md), [working queue](../analysis/WEB-PORT/WORKING_QUEUE.md). Their evidence dates and candidate identities supersede stale current-state statements in older milestone sections below. No new admin installation is requested.

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
  selected Vercel account/team. Authenticated Vercel MCP now reports the expected project and current Ready deployment.
- [x] Finish local checks/build/browser verification and record exact output.
  The full invocation plus affected WebKit rerun accounts for 288 unique passes
  and two expected platform skips. The hosting-only repair adds 35 PWA checks.
- [x] Deploy and verify the Vercel shell. The approved repository connection is
  restricted to ROMDex-Web and tracks the tested port branch. The 26 real-origin
  Chrome/Firefox checks pass; this is a preview, not a completed data migration.
- [x] Verify real-origin headers, service worker, HTTPS, routing, all 74 cached
  assets and offline note recovery on the actual hosted build.
- [x] Configure YouTrack CORS for the exact Vercel origin. After the owner's
  administrator-completion message, anonymous GET/POST/DELETE preflights return
  that origin and authorization/content-type permission. Authenticated reading
  remains a separate check; see CORS-ORIGIN-HANDOFF.md.
- [x] Confirm authenticated browser reads and native attachment delivery on the
  owner-authorized private PMON quarantine (Epic466, children467/468). Native
  Chrome and Firefox cycles pass; interrupted Firefox recovery also passes.
  Existing production work stayed outside the mutation allowlist. See
  NATIVE-ATTACHMENT-ACCEPTANCE-2026-10-25.md for exact evidence and limits.
- [ ] Verify actual Windows installation/launch from Chrome and Firefox. The
  automated standalone test emulates the display-mode signal; it is not OS-level
  installation acceptance. Chrome uses its install prompt/icon; recent Firefox
  Windows uses its address-bar web-app button.
- [ ] Resolve the native shared-status concurrency failure and retest it. No
  browser-local or serverless in-memory lock may be substituted for native proof.
- [ ] Once the safety gates pass, fully quit the desktop, preserve a complete
  backup, create a verified portable export and preview the import. Keep original
  desktop queues/files; never replay them as web requests.
- [x] Preserve source/packages/evidence on the private remote with the source
  branch and dated QA tag. Keep this branch
  open while migration is incomplete; no cleanup pruning.

## Current findings (reconciled October 26)

Acceptance app 1.0.12 remains restricted to NPCD-872 and NPCD-873. Both child
race requests succeeded at the same revision and only one receipt remained.
Production sharing is OFF and production source 1.0.8 remains withheld. Native
atomic commit/rollback is proven; cross-request serialization is not. JetBrains has now confirmed that this app mechanism has no supported atomic primitive or fix. A revised design needs a decision, implementation and native proof; no conflict-preserving alternative is accepted as safe yet.

The desktop remains authoritative, with owner-approved source updates and verified profile preservation. No live owner-workspace export/import or cutover has been performed. Private disposable PMON fixtures were created and used for native attachment checks; existing production work was preserved. See [ATTACHMENTS.md](ATTACHMENTS.md) for file-delivery
behavior and [LIVE-ACCEPTANCE-2026-10-24.md](LIVE-ACCEPTANCE-2026-10-24.md) for the
separate native metadata failure.

## Historical milestone evidence

The following dated milestones retain their original findings and candidate identities. Use the current phase reports above for remaining work.

### Portable-file repair checkpoint

The broader matrix reproduced a staging failure in the emulated iPhone runtime
before deployment. The old prebuilt archive was only uploaded to an undeployed
Vercel draft and was never published. The repair stores new files as byte buffers
and reads legacy Blob records. Nine focused iPhone transport/attachment checks
pass, and desktop browser legacy reads pass. A complete fresh matrix is required
before deploying the repaired artifact.

Repaired shell inventory:`4fdac68c7e01e658a764`, 75 cached assets, 78 upload
archive entries. ZIP SHA-256:
`64ec789ffcc6b1c3e54b4c29971797ad1165236198f87fabcb3e6dbee02df4b5`.
Source checkpoint:`ca80a48ad9f402e6c8983716b1b5aecdc4f910ba`.
The source checkpoint is not a completed production data migration.

## Final local matrix

`pnpm check` passes: 135 application tests and 30 Node/worker/YouTrack/hosting
tests. The final build contains the portable-byte repair. The full 290-case
browser invocation recorded 283 passes, two expected platform skips and five
WebKit file-interception assertion failures. A fixture-only correction routes
the actual generated FormData through the local native-byte receiver for both
WebKit profiles. All 18 affected-profile cases then pass. Case-by-case
reconciliation establishes 288 unique passes and two expected skips across
these runs, not one all-green full invocation. App source and every exported
asset remain byte-identical to the frozen deployment archive. Evidence is in
`docs/evidence/task-first-migration-2026-10-24/`.

## Vercel hosting acceptance and update path

The first static shell was deployed to https://romdex-web.vercel.app under
PMON Hobby. Hosted checks passed 22 cases and exposed four failures: root-page
headers were absent, and the offline worker attempted a Vercel-blocked debug
map. Vercel also appended its toolbar bootstrap to a runtime file. No daily-work
migration or YouTrack mutation was performed.

The hosting repair explicitly covers root-page headers, excludes debug maps
from the offline cache and disables the ROMDex project's Vercel Toolbar for
new deployments. Nine worker/hosting tests and 35 affected PWA/update/install
browser cases pass. The static repair archive is`romdex-web-shell-e9cc7b96a67580c0b9d0.zip`,
SHA-256`639ac50eefa16629b77ad706a421245284f2fb59b9c7690d50cde0aa63804a1d`.

The owner explicitly approved Vercel's GitHub application for only
GenericCola/ROMDex-Web and completed GitHub's identity check. The existing
Vercel project is connected to that repository; other private repositories
remain excluded. PR comments are disabled. Track`codex/accepted-app-port`
for this preview; do not deploy the older main foundation by mistake.

Git source builds produce a new Next build identity. Hosted verification must
hash every asset from the actual worker inventory against the exact committed
worker template, then test the rendered client. Do not falsely claim that an
independent cloud build is byte-identical to the earlier local archive.

Before the administrator's latest update, anonymous GET/POST/DELETE preflights
for the exact Vercel origin returned no Access-Control-Allow-Origin or
authorization header permission. That preflight blocker is now resolved; see
CORS-ORIGIN-HANDOFF.md. Resource Sharing was not exposed in this account's Global Settings UI;
a plain API page does not authenticate with browser cookies. No credentials were
extracted and no CORS settings were changed.

## Verified hosted preview

The owner's repository-only approval and identity verification completed. Vercel
is connected only to GenericCola/ROMDex-Web, with production branch tracking set
to`codex/accepted-app-port`. No billing changes, analytics or production
YouTrack sharing were enabled. The first Git build's nested pnpm invocation
selected Vercel's older 11.22.0 instead of the pinned 11.25.0; invoking the lint
script directly from prebuild repaired this without weakening version checks.

Successful deployment:`FSKqw4QpiYHd5UrgqBRmnRnA2Y5s`, source
`76fa8990e7d0cdac2d273e452dc7d5b66da98b50`, at
https://romdex-web.vercel.app. GitHub's Vercel status is success. All 26 hosted
Chrome/Firefox cases pass, including headers, worker policy, exact content
inventory, zero automatic YouTrack access, offline note recovery and synthetic
attachment/recovery/error paths. Both browsers independently verified worker
inventory`42c42d7e7149f040f502` and all 74 cached assets against the committed
worker template. Source-map debug files are excluded; the toolbar is disabled.

The actual hosted bytes are independently archived as
`hosted-shell-42c42d7e7149f040f502.zip`, SHA-256
`b2899b0bfc3cf73150d29bd333b9d640719484a034d05e214b996cafa617a385`.
The complete evidence is retained in this folder's dated evidence directory.
A private QA tag`romdex-web-hosted-qa-2026-10-24` preserves these final records
without advancing the live deployment branch solely for documentation. The
local branch's documentation/evidence commit is retained through that tag; the
remote application branch intentionally remains at the tested deployed commit.

Remaining gates: authenticated browser reading, native attachment acceptance, shared-status concurrency repair, actual Windows installation and
reviewed desktop export/import. No real PMON task was mutated, no desktop file
was replaced, and no live desktop export/import was performed. Desktop remains
the daily-work client and fallback. No new administrator app installation is
requested by this checkpoint.

## UI repair, October 24

The owner requested repairs to the visible web controls as part of migration.
The selected-task pane's four direct grid children compressed properties into
an implicit row and placed notes in the narrow column. The React markup now
keeps properties on the left and notes, images and attachments together on the
right. Header save-light spacing, centered dialogs, sticky close controls and
workspace-menu keyboard/pointer dismissal are also repaired. The accepted
desktop and its profile are unchanged. Verification and hosted delivery are
tracked in [UI-REPAIR-2026-10-24.md](UI-REPAIR-2026-10-24.md).

October 25: the owner resumed migration. UI source 3e8c0db is deployed at https://romdex-web.vercel.app and all 34 hosted Chrome/Firefox checks pass, including actual CORS refusal messages. See docs/MIGRATION-RESUME-2026-10-25.md (relative to repository root) for the active queue and evidence. Authenticated native acceptance, concurrent shared-status safety and desktop cutover remain pending.

October 25 authenticated-read follow-up: at the owner's request, the saved token was loaded into native Chrome without disclosure or a desktop file change. The actual hosted UI reported "396 tasks read. Review before saving a browser copy." The read form cleared its token, delivery remains disabled and the preview was not imported. This passes Chrome authenticated reading only; native attachment acceptance, Firefox authenticated reading, shared-status concurrency, actual installation and desktop cutover remain pending. The owner selected a JetBrains support request for the concurrency blocker; the draft and evidence packet are prepared but not sent.

Owner chevron correction: deployed source 36e748eaad7e360974c62c392a61c639ae19f804 removes the added workspace symbol while keeping its red control and behavior. Check/build, 15 affected local and 34 hosted cases pass. See evidence/chevron-removal-2026-10-25/QA-REPORT.md for current dispositions and limits. No desktop or real task data changes were made.

## Latest checkpoint — October 25 native attachments and support

The owner subsequently authorized disposable synthetic PMON tasks in a quarantined Test-only Epic. Private Epic PMON-466 and children PMON-467/468 were created for this scope. Native Chrome and Firefox authenticated reads, upload, exact-byte download, Cancel/reviewed deletion, disconnect/reload and empty final queues now pass on deployed source36e748eaad7e360974c62c392a61c639ae19f804. The earlier NPCD-only attachment restriction is superseded only for these fixtures; production tasks and desktop data remain intact.

Firefox's first upload confirmation exceeded the original harness's five-second assertion window. The original failure is preserved; exact recovery without resending passed, then one fresh cycle with thirty-second assertions passed. Its upload-to-confirmation boundary took5.212seconds, consistent with the timeout hypothesis without proving the original precise cause. No application code was changed for this test repair. Independent Test-QA review passed both recovery and the fresh cycle. Native error/limit/conflict cases beyond the observed interruption retain synthetic evidence; no blanket native failure-path pass is claimed.

JetBrains support was successfully submitted with the prepared source/synthetic evidence ZIP and related open report JT-98787. At this October 25 checkpoint SC-001 awaited an answer; the October 26 response above now confirms the design limitation. Native proof of a replacement remains pending. Production sharing is OFF; no new admin install is needed for this step. Actual Windows installed-app acceptance and reviewed desktop backup/export/import remain pending. Browser movement/minimization prevented a reliable installation check; no install was performed. See WINDOWS-INSTALL-ACCEPTANCE-2026-10-25.md.
