# Status dialog during synchronization

Requirement checklist:
- [x] Reproduce the inert Status popup and blocked X using the real guard, actual popup and delayed synthetic metadata acknowledgement.
- [x] Keep X and Cancel available during preparation; Escape remains available.
- [x] Show a readable pending message; prevent edits until the existing observed-base check succeeds.
- [x] Successful acknowledgement enables Status; selection records exactly the intended local edit.
- [x] Bound an excessive wait with a readable message and no edit; release the metadata hold after cancellation or a late acknowledgement.
- [x] Ignore abandoned replies across close/reopen; preserve original control state and dynamic editor controls.
- [x] Exercise stale-base/service errors through their visible message path, then successful reopening.
- [x] Keep parent status rules, notes, connection settings, cloud safety checks and desktop profile intact.
- [x] Verify installed desktop source and stage only the repair checkpoint; audit web for the same guard.

Initial finding: public/metadata-edit-guard.mjs marks the whole dialog inert while awaiting metadataEditorState. The service waits for the local engine/projection boundary, which can be delayed by a YouTrack request queued ahead of projection. The X is inside that inert subtree. Escape remains a native dialog action. This is a matching failure mechanism; no user data or live queue is used as a test.

## Corrected behavior

The guard now gates editing controls individually and leaves explicit Close/Cancel buttons available. It shows “Preparing this editor. Waiting for the current save to finish…” below the heading. The actual status choices stay protected until metadataEditorState acknowledges the observed base. The guard does not bypass or change the service's stale-head check, metadata projection hold, lifecycle checks or task delivery logic.

After 15 seconds without acknowledgement, the dialog closes without an edit and the existing shell status area displays: “The editor could not finish opening. No changes were made. Wait for the current save to finish, then try again.” This closes the editor; it does not cancel or restart the network save. A late acknowledgement is followed by the ordered release of its hold. Replies from an abandoned opening cannot unlock a newer one; queued openings that were cancelled before starting are skipped. Controls added during preparation are gated too, and existing inert state is restored exactly once. Cleanup still runs if metadata becomes inactive before dismissal.

## Evidence

The original blocked-X regression fails against the original guard: the real Close Status Menu button cannot receive pointer input because the dialog is inert. The reproduction uses synthetic PMON-900001/900002 tasks and a delayed metadata acknowledgement. No live issue is used.

Ten checks pass against the exact installed desktop source in Chromium. The fixture uses the actual desktop shell, DesktopWorkspace adapter, real Status popup, real guard registration and shell message renderer, with an explicit synthetic IPC bridge and intercepted local network transport. It is not a live Electron-to-service or YouTrack acceptance test. Checks cover:

- Real X during delayed acknowledgement; native Escape and dynamic Cancel.
- Pending message content and bounding box, visually inspected in the existing dialog style.
- Status choice blocked before acknowledgement, then saved locally while a synthetic YouTrack request remains in flight; continued assignment survives the older response.
- A late reply after close/reopen cannot enable the newer popup.
- Exact timeout, stale-head refusal and desktop-service error text through the actual shell display; fresh reopening works.
- Controls added during the wait, preservation of existing inert state, cancellation of unused queued openings, cleanup after metadata deactivation and local-only status editing.

The web/PWA does not use the desktop metadata guard. Its deliberate delivery transaction lock remains unchanged. The new web regression holds automatic delivery open, clicks an existing modal's X and verifies that task editing remains locked until delivery completes. It passes in all five browser profiles (five tests, 12.8 seconds). Browser device profiles are emulated; physical mobile acceptance is not claimed.

Current project check passes typecheck/lint, 133 application unit tests and 27 worker/backend tests. The production web build passes with 75 shell assets. The full browser matrix passes 233 tests with two expected mobile desktop-layout skips in 7.7 minutes. The worktree still contains pre-existing attachment work; this repair does not publish it.

Only public/metadata-edit-guard.mjs was replaced in the installed desktop. The full 132-file Data backup and post-install profile match byte for byte. Backup: C:/Users/mrgen/AppData/Local/ROMDexDesktop/Backups/status-dialog-2026-10-23T19-51-06-866Z. Private installer evidence is artifacts/desktop-status-dialog/installation.json; UI logs and synthetic screenshots are under artifacts/. Existing task/status code and connection providers are untouched. No administrator app installation, production sharing, PMON mutation or YouTrack setting change is involved.

Review traced guard acquisition/release, cancellation and late response identity, actual popup events, dynamic controls and restored state, timeout and service-error formatting, the unchanged native service validation, and the source-only installer. No unresolved defect found in these paths.

Reproduce the installed UI checks with node scripts/verify-desktop-status-dialog.mjs C:/Users/mrgen/AppData/Local/ROMDexDesktop/app-0.5.15/resources/app/public. The test bridge and transport are synthetic and cannot reach live YouTrack.
