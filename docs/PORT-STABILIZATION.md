# Task-port stabilization

Historical stabilization checkpoint. See CLOUD-DELIVERY.md for the subsequent delivery milestone.

Resumed at the user's request on October 22, 2026. The application port remains in progress on codex/accepted-app-port.

## Changes

- Corrected the synthetic read fixture's CORS headers and isolated it from service-worker routing. The task reader runs directly against the configured YouTrack origin; its test uses synthetic responses. Live authenticated CORS acceptance remains unverified.
- Narrowed the conflict-recovery alert assertion to exclude Next.js's route announcer.
- Locked editing while a PWA update waits for durable task/draft saves. Blocked updates and failures release the lock. Failed local saving blocks activation. Flush waits for any writes added while it was already waiting.
- Corrected the save lamp so locally queued cloud operations are not shown as delivered.
- Fixed scoped desktop CSS selectors that had accidentally changed device-body and work-body into invalid selectors. Verified the sidebar beside the task panes and added desktop geometry assertions.

## Verification

TypeScript, zero-warning lint, the static production build, twelve component/domain tests and eight worker/build tests passed. The production browser suite exercises Chromium, Firefox, WebKit, Android emulation and iPhone emulation. Task tests cover durable notes/comment drafts, switching/reopening offline, stale-window write protection, synthetic token non-persistence and retained drafts after blocked/accepted PWA updates.

The final suite has 43 passing checks and two deliberately skipped desktop-only geometry checks in mobile emulation. Desktop geometry is exercised in all three desktop engines. The visual review used synthetic task content at 1440 by 1000 pixels. It confirms the corrected pane arrangement, not complete UI parity.

## Remaining work

Safe cloud delivery and uncertain-operation recovery, complete task interaction/property/attachment parity, NPCDex, YouTrack content/metadata, RDX and previewed desktop-data import remain. Detailed workspace-record validation and recovery import also need further review. This checkpoint is not a replacement for the desktop app.

Desktop files, live data, credentials and cloud queues were not modified. These changes have not been deployed or pushed. The source-only reference remains separate from this repository.
