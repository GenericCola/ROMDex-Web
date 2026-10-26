# Debugging label correction

Requested October 26, 2026: rename the red status light from CRITICAL to DEBUGGING across desktop and web/PWA. Display text is Debugging, following the existing status labels' capitalization.

- [x] Shared red-light label, status controls and filters display Debugging.
- [x] Native YouTrack values, stored task values, Critical priority, red styling and rollup behavior are preserved.
- [x] Isolated desktop UI verifies the visible red status choice and filter; choosing it still stores Critical / Debugging. The installed two files exactly match the checked candidate hashes in patches/desktop-debugging-label.json.
- [x] Desktop was fully exited. Complete 134-file profile backup verified; every profile file remained byte-for-byte unchanged after installation. Source rollback copies are in the same private backup.
- [x] Web typecheck, lint, 135 application tests, 30 worker/backend tests and production build pass. Worker: 1f821e774c62812122b2, 74 assets.
- [x] Existing task/status/filter browser checks: 38 passes, two expected mobile geometry skips. All five configured browser profiles ran.
- [x] Fresh Chromium and Firefox UI checks verify Debugging selection, red accessible light, filtering and unchanged native value and Critical priority. All external requests were blocked.
- [ ] Deploy and verify the hosted label.

Main Agent handled this small presentation change directly. No new dependency or permanent test harness was needed. A temporary desktop assertion incorrectly expected uppercase CSS on the button; inspection confirmed the existing title-case rendering. A temporary web locator expected an explicit value attribute on the unchanged priority option; using its accessible option name fixed the check. Neither failure required application changes.

Evidence is retained under artifacts/debugging-label-2026-10-26, including screenshots, logs, source hashes and the private installation receipt. Desktop runtime reopening is user acceptance; the isolated UI check is not a live cloud-sync test. No YouTrack app update or task-data mutation is part of this label change.
