# Standby threshold and desktop metadata sync repair

Requested October 23, 2026 while live acceptance was in progress. The latest user correction supersedes the October 22 never-inherit rule. The user explicitly approved @theGobindSingh reading metadata in GenericCola/ROMDex-Data. The approval does not authorize any other collaborator, a public repository, changed ownership or changed history.

## Requirement checklist

- [x] Zero children retain the task's own assigned status.
- [x] Exactly one Standby child produces In Progress, including a single inherited-Standby child.
- [x] Two or more children, all effectively Standby, produce Standby.
- [x] Mixed Standby/Done stays In Progress. Existing grey/yellow, development, critical and Awaiting Testing precedence stays intact; recursive rollups use each immediate child's effective status.
- [x] Keep parent assignments separate; removing or moving children recalculates the threshold and removing the last child restores the own choice.
- [x] Apply the same rule to web lamps/delivery, backend source/acceptance and installed desktop. Bump shared rule compatibility so older handlers cannot deliver different results.
- [x] Diagnose the actual desktop indicator: YouTrack Tasks Up to Date, 0 Pending; ROMDex Metadata Local Recovery Required, 3 Pending, Cloud Collaborators Require an Authorization Review.
- [x] MCP readbacks of PMON-54, PMON-67 and PMON-2 exactly match the saved desktop summary, description and native State. The task queue is empty and unblocked. No local task operation was reset or discarded.
- [x] Verify private ROMDex-Data identity 1421625633 and its collaborator @theGobindSingh (58527382). Owner 32021766 remains GenericCola. The owner explicitly approves this collaborator for metadata sync.
- [x] Extend only the desktop collaborator allowlist to those two IDs; retain all other identity, privacy, pagination, history, bootstrap and immutable-record guards.
- [x] Verify allowed and denied collaborator paths with synthetic I/O and complete the desktop notes regressions.
- [x] Back up code and the complete private Data folder after clean exit. Code-only installation must leave every data-file hash unchanged.
- [x] Reopen the original profile and run normal Save Changes. Verify actual YouTrack and metadata status, pending counts and cloud receipts; retain all local work and genuine conflicts.
- [x] Run web checks/build and the final complete browser matrix. Keep developer write probes pending until the administrator candidate is installed; production sharing stays off.

Before installation, the desktop itself reports Connected as James Loder. Live sync is available, with a successful remote check at 03:47 EDT. The overall red indicator is accurate because metadata remains unsynced; it must not be described as wholly healthy until this is resolved. No evidence links the YouTrack acceptance app installation to a broken task token.

## Verification and preservation

The final web worktree passed pnpm check: TypeScript, zero-warning lint, 132 unit tests and eight worker/build checks. Production build passed. The complete five-target browser matrix passed 198 tests in 7.0 minutes with two expected mobile desktop-layout skips. The changed threshold, recursive single-child exception, movement, reload, native delivery and old-rule refusal passed through actual rendered controls. These are synthetic browser adapters, not native YouTrack acceptance.

The desktop verifier passed three tests: all 343 three-child combinations agree with web; child counts 0/1/2/3/10 respect the threshold; actual derived-status delivery preserves own assignments, crosses the two-child boundary, restores the last-child assignment and sends no repeated writes. Seven collaborator/privacy variants verify the allowed IDs and refusal branches without network or credentials. Six desktop notes regressions and four packaged-UI notes scenarios passed before installation. The installed files exactly match the tested candidate. Existing live tasks were not changed into developer fixtures. A specifically observed all-Standby parent in the user's native desktop UI remains additional user acceptance; the installed calculation and delivery are automated checks.

After the user's clean-exit confirmation, a complete private backup was created at C:\Users\mrgen\AppData\Local\ROMDexDesktop\Backups\standby-metadata-20261023T075525Z. All 131 Data files were hash-verified against the backup and remained byte-identical across installation. Only public/core.mjs and cloud/github-store.mjs were replaced. Credentials, task queues, notes, genuine conflicts and NPCDex content were retained. The code diff is patches/desktop-standby-metadata.patch; the private hash receipt is artifacts/desktop-standby-metadata-install.json.

The original app/profile was reopened and normal Save Changes was selected through the desktop UI. The final header says All Configured Sync Connections Are Healthy; YouTrack Tasks, NPCDex and ROMDex Metadata are Up to Date. Connection Details reports zero pending for all three. YouTrack says All Changes Saved to YouTrack. Metadata says ROMDex Metadata Cloud Copy Is Current after the dialog closes. NPCDex reports Content Is Up to Date and No Successful Remote Sync Recorded; this check does not claim a new NPCDex cloud publication.

The live metadata journal was inspected read-only. All three previously pending IDs are acknowledged, outbox is empty and review is false. GitHub MCP independently found all three immutable record paths in cloud carrier 55b92bb686080aad012cc228940a85dcec835c09; no repository permission was changed. PMON-54, PMON-67 and PMON-2 MCP readbacks exactly match saved desktop titles, descriptions and native State. The native task queue is empty and unblocked. This was the user's requested normal PMON sync, separate from developer acceptance restricted to NPCD-872/873. The app remains open for ordinary use.

Production source/package 1.0.5 advertises statusRules 4, SHA-256 ff5cac3890d9fbbdef0bcfc5ec79db16aaaf123e752cd7cec2656c4b717b34db. It is not installed or enabled. Acceptance candidate 1.0.6 advertises the same rules, SHA-256 7ff2b4c4fa9d34592cdcd8c6cce25e63025ab7960e8668bd2894f53dd8bfb659. The administrator must install that candidate in place before live metadata/transaction checks can continue. All historical archives remain intact. Native positive Standby/testing app checks remain pending because NPCD lacks those State values; no schema was altered.

## Review

What this change does: Applies the owner's corrected two-child Standby threshold consistently and resumes desktop metadata delivery for the one explicitly approved collaborator. The review traced recursive colors, retained parent assignments, protocol compatibility refusal, guarded cloud publication and actual desktop save feedback. All other identity, privacy, pagination, bootstrap, history and immutable-record protections remain. No additional permission, production web sharing or acceptance scope was enabled. Native YouTrack acceptance remains pending; local tests cannot establish its transaction rollback.
