# Paused web-port checkpoint

Paused at the user's request on October 22, 2026. Do not resume implementation until the user asks.

The user supplied PASSKEY for porting the current accepted app first, then finishing remaining features on web. The desktop app and its data remain the fallback and were not modified. The source-only reference is C:\Users\mrgen\ROMDex-Desktop-Reference, verified against the migration manifest. Do not run migration/install/sync scripts or copy appdata and credentials into this repo.

## Implemented so far

- React task shell and panes using the accepted installed 0.5.15 styles and shared SVG assets.
- Reused pure accepted hierarchy, status-rollup, materialization and reconciliation modules with typed interfaces.
- Local task creation, properties, notes, comment drafts, deletion review, selector navigation and pane controls.
- IndexedDB persistence with serial writes, transaction completion, revision checks against stale-window overwrites and in-memory recovery export on failure.
- Direct read-only YouTrack task adapter and a review step before saving a browser copy. Tokens stay in dialog memory. No live backend requests were made during tests.
- PWA update controls await pending workspace writes and refuse activation when local saving fails.
- The original component showcase remains at /foundation/.

## Last completed verification

pnpm check and pnpm build passed. Ten unit tests and eight worker/build tests passed. Production browser suite: 28 passed and 7 failed out of 35.

Five failures were caused by the stale-window assertion matching both the recovery alert and Next.js's route announcer. The locator has since been narrowed, but that correction has not been rerun. Two failures were WebKit/iPhone direct-read fixture CORS failures; the fixture response needs explicit CORS headers and a fresh browser run. The core durable-draft/offline task test passed in all five browser configurations. The original PWA foundation tests also passed in all five.

The pending command to fix the CORS fixture, adjust the save lamp and take a screenshot was rejected by automatic approval review after the user requested a pause. None of those pending changes ran. No task-port screenshot was captured. No preview or browser-test servers were listening on 3000, 3001 or 3100 at the pause check.

## Resume from here

1. Read AGENTS.md and docs/PORT.md, then inspect this checkpoint and the current diff.
2. Fix/rerun the two browser-test issues above. Keep fixtures synthetic and do not use production credentials or queues.
3. Review browser workspace validation, PWA draft/update gating and storage recovery before expanding the workflow. Ensure the save lamp distinguishes pending cloud operations from completed delivery.
4. Visually compare the scoped React UI with the accepted desktop references. Basic React behavior passing does not establish visual or interaction parity.
5. Continue the authorized port checklist: safe YouTrack delivery and uncertain-operation recovery, full task interactions, NPCDex, content/metadata, RDX and previewed data migration. NPCDex is currently an explicit placeholder. The port is not ready to replace the desktop app.

No new port changes were pushed to GitHub. Main still contains the tested foundation checkpoint 866fd97. Work is local on codex/accepted-app-port.
