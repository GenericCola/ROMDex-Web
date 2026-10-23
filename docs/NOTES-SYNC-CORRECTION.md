# Notes editing and self-conflict correction

Requested October 22, 2026: notes were uploaded during composition and later revisions conflicted with an earlier, shorter upload. Preserve all text and genuine remote-conflict checks; length or prefix similarity does not prove authorship.

## Checklist

- [x] Persist each edit locally while composing, including offline and storage-failure recovery.
- [x] Automatic task delivery pauses while a notes/text editor is active, including timer, reconnect and enable-sync paths. Leaving the editor resumes the normal automatic schedule. Explicit Save Changes can send a snapshot.
- [x] Edits during an already in-flight snapshot remain queued against their own predecessor, not a stale rendered baseline; completion never discards newer text.
- [x] Track the exact editor baseline without replacing it on an unrelated remote refresh. A genuine remote edit still blocks delivery, including a longer or prefix-related value.
- [x] Verify appending, replacing and deleting text, rapid edits, task switching, reload, manual Save and Auto-Sync Off.
- [x] Confirm actual desktop and web hints/status/review messages through their selection paths, including real conflicts and local save failures.
- [x] Back up changed installed code while fully exited; verify all desktop data/credential file hashes remain unchanged. Keep the earlier Standby correction.
- [x] Run required web checks/build/browser matrix and isolated desktop engine/UI checks using fictional notes only. Record code/synthetic results separately from owner-observed desktop and live acceptance.

The unrelated attachment implementation remains unfinished and uncommitted. No production note, queue, credential or conflict is read, reset or replayed as a test.

## Cause and behavior

The desktop could send an edit while the user continued typing. A later operation used a rendered baseline that lagged behind that upload. Three-way reconciliation then compared the longer local continuation against an older base and the app's own uploaded intermediate version. The original regression failed with Before as the baseline instead of Before partial.

Each keystroke still enters durable local storage. Focus on Notes or Task Title holds automatic task delivery, including the periodic and wake paths. Leaving the editor resumes the existing schedule; explicit Save Changes sends the current snapshot. Both platforms check focus again after asynchronous preparation. Desktop also checks immediately before its request, so a focus change during status or file preparation cannot upload partially composed notes.

The desktop follows queued predecessors when constructing new-operation baselines. The editor advances its own baseline when submitting local text and changes it during rendering only when it actually accepts the rendered value. A focused field retains its prior baseline across remote refreshes. Confirming an earlier snapshot removes only that operation; newer text remains queued. Appending, replacing and deleting text use the same rule. Genuine external edits still conflict, even if one value contains the other.

The native bridge exposes only setTextEditing with notes/title and a boolean; existing origin checks remain. Focus state is transient and is never written into saved workspace data. A pending local-only text change keeps the desktop Save lamp on, with Text Changes Saved Locally · Leave the Editor or Use Save Changes. Local errors retain the existing Local Save Failed message. The web hint explains local saving, the focus hold and explicit Save; genuine conflicts retain the existing Review conflicting edits. Both versions were preserved. path.

Existing blocked conflicts are not automatically resolved: an old journal does not retain enough text receipts to prove an apparent intermediate value was the user's own upload. Existing conflict copies and queues stay intact. Previously blocked conflicts still require explicit review. No rule chooses content by length or silently overwrites a remote value.

## Installed code and preservation

The owner confirmed full exit before each installed-code update. Original code is retained in C:/Users/mrgen/AppData/Local/ROMDexDesktop/Backups/notes-editing-20261022-235245. The additional final engine guard is backed up in C:/Users/mrgen/AppData/Local/ROMDexDesktop/Backups/notes-final-guard-20261022-235947. Each directory contains a receipt with exact code hashes. All 131 desktop data-file hashes matched before and after each update. No saved notes, credentials, queues or conflict snapshots were edited. The original source reference and the previous Standby correction remain intact.

The final installed files match the tested code-only staging copy byte-for-byte. The patch is retained in patches/desktop-notes-editing.patch. No renderer or desktop credential is added to the production web bundle.

## Verification

Six engine/bridge checks pass against the installed public code, using memory storage and a fictional transport: in-flight append/replace/delete, held auto-delivery and manual Save, genuine external edits, native IPC validation, focus changes during status preparation and focus changes during file preparation. Four UI checks pass against the actual installed shell, task markup and Save coordinator with all requests intercepted: local persistence/blur/reload, explicit in-flight Save followed by continued typing, a remote refresh followed by a genuine displayed conflict, and the exact disk-failure message with typed text preserved. The NPCDex provider in this harness is empty and synthetic. This exercises the UI/controller selection paths; it does not launch the installed Electron process or access live issues.

Re-run the engine checks with Node scripts/verify-desktop-notes.mjs followed by the installed public code directory. Re-run the isolated UI with Node scripts/verify-desktop-notes-ui.mjs and the same directory. The scripts use local code only; UI routes refuse external requests and never load real seed or addon content.

The web preparation-race unit check runs the exported automatic/manual entry points with delayed editor preparation and observes that automatic delivery never starts while the user has resumed typing. Explicit Save remains available. Current worktree pnpm check passes type checking, zero-warning lint, 128 unit tests and eight worker/build checks. pnpm build passes with 75 shell assets. Eight unit tests and related UI belong to ongoing attachment work, which remains unfinished. The ten focused note/conflict browser scenarios passed all five targets before the final additional preparation guard. The final complete frozen run passed 198 tests with two expected desktop-layout skips on mobile (6.8 minutes), including all 15 note-editing/conflict/recovery scenarios across Chromium, Firefox, WebKit, Android and iPhone emulation; an earlier run was intentionally stopped before changing that guard and is not acceptance evidence.

## Pending acceptance

- [x] Final complete frozen browser matrix: 198 passed, two expected mobile layout skips; typed notes remained recoverable after storage failure on all five targets.
- [ ] Owner-observed desktop use: type a note with pauses, confirm it stays local while focused, then leave the editor or choose Save Changes; the completed note should sync without a self-conflict.
- [ ] Live YouTrack end-to-end acceptance and physical-device checks remain subject to the existing project/fixture and deployment boundaries. No live PMON issue is a developer mutation fixture.
