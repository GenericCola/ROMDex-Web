# Standby inheritance correction

Requested October 22, 2026: Standby is not inherited from children; a parent whose children are all Standby becomes In Progress. This correction also treats mixed Done/Standby children as In Progress, because outstanding Standby work is incomplete. The existing Awaiting Testing, Critical and In Development precedence stays intact.

## Behavior and acceptance checklist

- [x] Web lamps use In Progress for one or more all-Standby children and mixed Done/Standby children.
- [x] The rule propagates through ancestors and never produces inherited Standby for any nonempty child combination.
- [x] Leaf Standby and Prompt Ready alias remain blue; parent assigned choices stay saved. Removing the last child restores the parent's own choice.
- [x] Testing, critical, development, all-untouched and all-done precedence stay intact.
- [x] Browser-only native delivery writes In Progress and repeat Save sends no duplicate mutation.
- [x] YouTrack handler rejects inherited Standby and calculates In Progress while retaining assignment metadata.
- [x] Shared client requires statusRules 3; older rule sets stop before reading/writing issue metadata. App package version is 1.0.4.
- [x] Installed desktop uses the same corrected display and native-delivery rule. Back up original code while fully exited; do not change saved data or credentials.
- [x] Update administrator handoff to version 1.0.4 with verified ZIP checksum; retain 1.0.3 as historical evidence.
- [x] Current code/unit/build/browser checks pass. Actual desktop visual acceptance and deployed YouTrack execution remain separate pending checks.

No live cloud writes are part of this correction. The ongoing attachment implementation remains uncommitted and is not declared complete by this ticket.

## Verification evidence

The regression tests failed against the original rules (blue instead of yellow; the handler incorrectly accepted inherited Standby), then passed after correction. The dedicated unit checks cover all 343 three-child combinations, aliases, empty children, nested rollups, preserved assignments and handler rejection of the old result. Existing delivery checks cover all-Standby and mixed Done/Standby children, other status precedence and last-child restoration.

The new browser scenario passed all five configured targets through actual lamps, the Assigned Status picker, Save Changes, repeat Save, reparenting and reload. The full frozen regression matrix passed 183 checks, with two expected desktop-layout skips on mobile, across Chromium, Firefox, WebKit, Android and iPhone emulation. Shared-status compatibility checks reject missing, version 1 and version 2 rules before metadata reads; the browser suite also checks the actual refusal message and verifies zero metadata requests or writes.

The installed desktop file was backed up to C:/Users/mrgen/AppData/Local/ROMDexDesktop/Backups/standby-rollup-20261022-225254/core.mjs after the owner confirmed exit. Original code SHA-256: 1456dee8f1fa04bb83ad3c8ebdee9258c7fb35cacc699f25f78ee812c0c4da5c. Patched code SHA-256: 8ec008371384f215b6bbe9cf78d7a0fd6c3f8bd42a2ebbe666d6dfb215d9f3b5. The combined before/after data digest was identical for all 131 files. No data file or credential was changed. Installed-core checks matched web for every three-child combination. The actual installed YouTrack.derivedStatuses method passed nested yellow delivery, no writes on a repeat cycle and own-assignment restoration after last-child removal with synthetic I/O and network disabled. These are code checks, not user-observed desktop UI or live YouTrack writes.

App version 1.0.4 advertises statusRules 3. The production ZIP contains six exact source entries and has SHA-256 14c70d53dd7b64899a442cd5f0e6613cac441e482e77c1807d77032de455d848. The restricted acceptance ZIP contains nine entries and has SHA-256 4b2635a7c47ce2d431d51502f7b6666825745e50f9b9232f7012f90daa670c5a. Independent ZIP checks verified CRCs, rule source, manifest and exact issue allowlist. The administrator checklist now requests 1.0.4. The installed tenant app has not been updated by this correction.

Current worktree checks: pnpm check passed type checking, zero-warning lint, 126 unit tests and eight worker/build checks. pnpm build passed and produced 75 shell assets. Eight unit tests and the staged-file interface belong to ongoing attachment work; their presence does not close attachment acceptance. The status checkpoint keeps that implementation separate.

## Pending acceptance

- [x] Full frozen browser run: 183 passed, two expected mobile layout skips, no failures (6.5 minutes).
- [ ] Owner-observed desktop lamps after reopening: an all-Standby parent is yellow, children remain blue, own assigned choices remain selected, and Awaiting Testing still takes precedence.
- [ ] Administrator installs and activates the corrected acceptance package; run live checks only within NPCD-872/NPCD-873. The NPCD bundle differs from PMON and must not be changed to manufacture a Standby test value.
- [ ] Production installation and real-origin/device checks remain subject to the existing migration acceptance gates.
