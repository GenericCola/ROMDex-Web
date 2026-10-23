# Live acceptance, October 23, 2026

Only NPCD-872 and NPCD-873 are authorized for test writes. PMON, production sharing, the installed desktop app and its data remain intact. The owner reports the administrator granted full permissions; actual access must be verified, without changing roles or security settings.

## Requirement checklist

- [x] Read both fixtures through MCP before any mutation. Root Open, child Done; both private to GenericCola. Only the matching synthetic parent/child link is present. No attachments or comments.
- [x] Read NPCD State schema: Open, In Progress, In Review, On hold, Done, Canceled. Preserve the bundle; positive Standby and Needs Testing acceptance cannot run here.
- [x] Inspect installed app: ID 155-84, version 1.0.4, system Active. Widget visibly reports "There was a problem loading the widget" and "Error: Failed to load frame content:" before test buttons load.
- [x] Live Projects tab lists only NPCD, Active. The acceptance row has no auto-attach tag; explicit Auto-attach OFF remains administrator-reported. No attachment setting was changed.
- [x] Corrected widget paths in acceptance-only 1.0.5; independent nine-entry ZIP/CRC inspection and manifest resolution pass. Exact fixture/summary guards pass. Original acceptance 1.0.4 and production 1.0.4 hashes are unchanged.
- [x] Refreshed the administration page and attempted the authorized 1.0.5 update. YouTrack rejected global-level module update permission. Installed version remains 1.0.4; no roles or settings were changed.
- [ ] Confirm capabilities identity, schema 1 and statusRules 3 before any write.
- [ ] Repeat fresh metadata reads: no initialization or timestamp change.
- [ ] Verify separate assignment, exact receipt, harmless replay, changed payload with reused ID rejection and stale-write rejection.
- [ ] Verify parent rollup from Done child and preserved own assignment; leaf calculation separately.
- [ ] Verify exactly one same-revision concurrent writer succeeds.
- [ ] Verify metadata persistence on reload and a fresh page. This is not physical cross-device acceptance.
- [ ] Verify forced post-mutation rollback with unchanged metadata, native State and timestamp and the intended exception marker or server logs.
- [ ] Verify external native State changes through MCP and restore child Done. Retain fixtures and receipts.
- [x] Recorded pending checks here and prepared artifacts/romdex-admin-followup-2026-10-23.txt.

## Packaging finding

The 1.0.4 acceptance ZIP places index.html and panel.js under acceptance/, while manifest indexPath is relative to widgets/. The 1.0.5 test-only repair places both files under widgets/acceptance/. Production manifest remains 1.0.4 and its package is unchanged. The Host API injects YTApp; a separate SDK import is not required.

References: [JetBrains app manifest](https://www.jetbrains.com/help/youtrack/devportal/app-manifest.html), [Host API](https://www.jetbrains.com/help/youtrack/devportal/apps-host-api.html).

No live write result is claimed at this checkpoint. Initial fixture timestamps were unchanged from October 22 at 20:04:21 in the MCP output.

## Live result and pending work

Both NPCD-872 and NPCD-873 display the native widget-load failure. No test button is available, so none of the unchecked checks above ran. In particular, there is no live assignment, rollup, competing-writer, replay, fresh-page persistence or rollback result. No missing canonical State value was added, and no other project was used as a substitute.

The UI rejected the corrective upload with: "Could not import app. You don't have the necessary permissions to update an app with global-level modules." Administration also displays: "You can’t update the global settings for this app because these changes may affect projects where you don’t have the Update Project permission. Please contact a system administrator for assistance." This is an observed YouTrack permission refusal, not a local tool approval rejection. The signed-in account is GenericCola, displayed as James Loder. The administrator-reported full permission grant is not established by these results.

JetBrains [permission reference](https://www.jetbrains.com/help/youtrack/cloud/youtrack-permissions-reference.html) requires effective global Low-level Admin Write to update global modules. An administrator can simply perform the in-place update; broader grants are not necessary to run fixture acceptance. Do not alter permissions or weaken the guard to make the test pass.

Before and final MCP records for both fixtures are exactly equal, including State, hierarchy, visibility, description and timestamps. The child remains Done and the root Open; neither needs restoration. The installed desktop, its data and credentials were not accessed or changed. No PMON or production mutation was attempted.

Private raw evidence is retained under artifacts/live-acceptance-2026-10-23/: baseline-mcp.json, final-mcp.json and browser-evidence.txt. Browser screenshots are retained there too. The ZIP checksum is 2d08fc65891ae39fd18217640c38cfb9141d6446d57930630d3757345d316103.

## Local verification

Type checking, zero-warning lint and production build passed. The final unit suite passes 129 tests; all eight worker/build checks pass. Five packaging/harness checks include resolution from widgets/ plus actual Run-button failure selection for incompatible identity, project, schema and rule version. These are local checks, not live YouTrack handler acceptance.

The full browser regression suite passed 198 tests in 7.1 minutes, with two expected desktop-layout skips on mobile, across Chromium, Firefox, WebKit, mobile Chromium and iPhone emulation. These use local synthetic adapters. They do not establish native YouTrack isolation, physical cross-device behavior, production CORS or rollback.

## Review

What this change does: Places acceptance widget assets where YouTrack resolves indexPath, versions the acceptance package separately from production, and prevents its Run action from proceeding with incompatible server capabilities. Reviewed package consumers, source paths, exact issue guards, production preservation and the displayed refusal path. Looks good for the source checkpoint. No additional findings in this acceptance-only change. The unrelated attachment work remains uncommitted and intact. Live server acceptance remains blocked by the administrator update.
