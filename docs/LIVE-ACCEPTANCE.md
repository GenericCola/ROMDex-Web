# YouTrack live acceptance

The owner authorized test-only app installation and live testing on October 22, 2026. No disposable project exists. The owner then explicitly chose NPCD, an existing project, for testing. Existing NPCD issues and settings must be preserved. Production PMON sharing remains off, and the desktop app, saves, source reference and credentials remain intact.

## Installed state and blocker

A separate app named romdex-status-acceptance, titled ROMDex acceptance - synthetic issues only, version 1.0.1, is installed and attached only to NPCD. Its YouTrack app ID is 155-84. It is inactive system-wide. GenericCola can upload a new app through NPCD settings but cannot manage its system Active switch. The UI explicitly says the account does not have permission to manage this setting. The project switch is disabled because the app is deactivated system-wide.

An attempt to update the installed test harness was also rejected: updating an app with global-level modules requires permissions this account lacks. The frozen local 1.0.1 handoff ZIP includes a stricter rollback acceptance check; an administrator must upload it before running the tests. No activation or permission bypass was attempted.

No live assigned-status, rollup, concurrency or rollback acceptance result is claimed. Creating the fixtures and server validation of the uploaded modules succeeded. Handler execution remains blocked by activation. The installed panel is an earlier harness revision; use the final package below when continuing.

The subsequent Awaiting Testing light change is packaged as version 1.0.2. It does not replace the frozen 1.0.1 administrator handoff ZIP or update the inactive tenant app. Its new rollup value still needs live acceptance where that State already exists; do not alter NPCD's State bundle for this feature. The package command below now generates version 1.0.2; the recorded 1.0.1 ZIP remains available at its original path. Its reproducible source checkpoint is commit 7ff70a0.

## Test fixtures and package boundaries

MCP created NPCD-872, the synthetic root in Open, and NPCD-873, its synthetic child in Done. Both are visible only to GenericCola. Summaries start with [ROMDex acceptance]. The child is linked only to the synthetic root. MCP readback confirmed their State, Type, visibility and hierarchy. Neither fixture has comments or attachments.

Run pnpm package:youtrack --acceptance to build artifacts/romdex-status-acceptance-1.0.2.zip and its SHA-256 file. The build reads youtrack-acceptance/scope.json and adds both exact-issue and summary-prefix guards to the accepted handler. Only NPCD-872 and NPCD-873 are allowed. Other NPCD issues and every PMON issue are rejected. The separate app identity keeps test properties apart from production storage.

The acceptance ZIP contains the six production source entries, with test-only identity and guard substitutions, plus acceptance/index.html, acceptance/panel.js and fault.js. The panel uses YouTrack's authenticated Host API; it does not request or store a permanent token. No test runs automatically. The fault endpoint is restricted by the same issue guard and is used only to check transaction rollback. It deliberately changes the synthetic issue and throws. It never appears in the production archive.

The frozen 1.0.1 handoff ZIP SHA-256 is 623d3c4c6183d51b5d81463772de9ae21cdbc6b2190c5be022f9f3959ee83648. The independent ZIP check verified nine entries, CRCs and the checksum.

The normal pnpm package:youtrack command still builds the production app with no widgets or test fault endpoint. The test build cannot be aimed at another project through a command-line argument. Changing its allowlist requires an explicit source change and renewed review.

## Administrator handoff

Send the administrator the frozen 1.0.1 handoff ZIP and this message:

> Please upload the attached romdex-status-acceptance-1.0.1.zip through Administration > Apps to update the existing ROMDex acceptance - synthetic issues only app. Then turn its system Active switch on. In NPCD > Settings > Apps, ensure the same app is active for NPCD only. The code permits only the newly created private fixtures NPCD-872 and NPCD-873, whose summaries start with [ROMDex acceptance]. Tests run only when triggered manually. Do not attach the app to PMON, enable production sharing, change existing issues or broaden permissions. Please confirm when the update and activation are complete.

App administration: https://thegobindsingh.youtrack.cloud/admin/apps

NPCD app settings: https://thegobindsingh.youtrack.cloud/projects/NPCD/settings?tab=apps

This requests an administrator to perform the narrow activation step. GenericCola does not need additional tenant-wide permissions for the tests. Do not detach or uninstall the app as a cleanup step without preserving test evidence; these operations can delete app-owned storage.

## Checks to run after activation

1. Open NPCD-872 and use Read live metadata. Verify the app identity, issue identity, State, timestamp and uninitialized revision before any write. Repeat the read to check that GET does not initialize storage.
2. Run the assignment, rollup and concurrency checks. The parent receives an In Progress assignment while its Done child keeps effective State Done. Fresh requests must return the exact stored receipt. Replays must not create a new revision; changed payloads with the same ID and stale revisions must fail. Two simultaneous same-revision writes must admit exactly one writer.
3. Reload the issue and open a second fresh page. Read metadata again. Assigned choice and effective State must survive the new page without using a saved local assignment. This is fresh-page persistence; it does not establish physical-device or real-origin PWA acceptance.
4. Run the forced rollback check on the initialized root. Verify unchanged metadata, State and timestamp. The panel must also confirm the intended post-mutation exception. A generic permission error or an earlier runtime failure cannot count as rollback success. If YouTrack hides the exception marker, inspect app logs before accepting the result.
5. Use MCP for fixture State changes and readback. Verify external native edits, then restore the synthetic child to Done and repeat the parent calculation. Never change an existing issue, field bundle or workflow. Leave the fixtures and receipts for review rather than deleting them.

Real-origin browser CORS, different permission levels, physical-device behavior, unavailable-app recovery and the PMON field configuration still require separate acceptance evidence. The NPCD State bundle differs from PMON; it has Open, In Progress, In Review, On hold, Done and Canceled. Do not add or rename values in that shared bundle to make a test pass. A missing canonical value must stop the write.

## Installation finding and fix

The first upload was rejected because global and issue-scoped endpoints cannot share one HTTP handler module in this tenant. Capabilities now live in capabilities.js at capabilities/check; status.js contains issue-scoped endpoints only. The browser client and synthetic adapter use the new route. Version 1.0.1 was accepted by YouTrack with separate modules. Regression tests reject mixed scope families and verify that the acceptance archive blocks non-fixture issues.

## Version 1.0.1 checkpoint verification

Verified on October 22, 2026: pnpm check and pnpm build passed. The final complete unit run passed 86 tests, including the tightened rollback acceptance check; all 8 worker/build checks passed. The browser suite passed 118 tests across Chromium, Firefox, WebKit, mobile Chromium and iPhone emulation, with two expected desktop-layout skips on mobile. These are local synthetic tests. Live execution remains unverified until the administrator update and activation succeed.

What this change does: Separates global capabilities from issue endpoints and packages an exact-fixture acceptance harness. Reviewed request routes, build boundaries, issue allowlists, archive contents and failure checks. Looks good for the private implementation checkpoint. Not checked: live handler execution, deployed concurrency and rollback, different permission levels, real-origin CORS or physical devices. Production sharing must remain off.
