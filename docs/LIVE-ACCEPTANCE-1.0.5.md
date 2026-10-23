# Live acceptance after the 1.0.5 administrator update

October 23, 2026. The administrator reports an in-place update of app 155-84 to 1.0.5, checksum verified, system Active ON, NPCD Active, NPCD as the sole attached project, Auto-attach OFF and storage retained. No account permission grant was made; future app updates must go through the administrator. PMON, production sharing, CORS, workflows, State values and attachment limits remain unchanged.

## Requirement checklist and evidence

- [x] Read both synthetic fixtures and the NPCD State schema through MCP before testing. Root NPCD-872 is Open; its only child NPCD-873 is Done. Both retain GenericCola-only visibility and their original descriptions, hierarchy, types and empty comments/attachments.
- [x] Inspect app administration: same app 155-84, installed 1.0.5, system Active. Project isolation and Auto-attach OFF are freshly administrator-reported; no project or activation setting was changed.
- [x] Reload the native issue pages. The 1.0.5 widget loads and displays its Ready message and test controls on both fixtures. This resolves the 1.0.4 widget path failure.
- [x] Select Read live metadata on NPCD-873 and NPCD-872. Both show exactly "FAIL 500 " in the status output. No metadata snapshot is returned and no write test is allowed to count as passed.
- [x] Export the acceptance app log using the available Download logs control. The resulting romdex-status-acceptance.log is zero bytes. The script console contains no usable server exception. The HTTP 500 cause remains unconfirmed.
- [x] Try the guarded Run sequence on the root. It stalls before its first success line; the browser console reports TypeError: Cannot read properties of undefined (reading 'scope') in the deployed Host API fetchApp implementation, at 2026-10-23T07:41:06.396Z. The call omitted the options argument. Reload stops this stalled frontend action. No fixture POST stage was reached.
- [x] Prepare test-only 1.0.6 with explicit scope:false options for the global capabilities request, exports-object utility loading, unexpected-exception logging and a post-mutation forced-rollback marker. All original issue, summary, permission and protocol guards remain. The historical production 1.0.4 package remains unchanged. The subsequent owner correction updates production source 1.0.5 and acceptance candidate 1.0.6 to the two-child Standby threshold, statusRules 4. No production installation or sharing occurred.
- [ ] Install 1.0.6 through the administrator, retaining app ID, storage and NPCD-only scope. This is a candidate compatibility repair; a live resolution of the HTTP 500 is not established.
- [ ] Confirm live capabilities identity, schema 1 and statusRules 4 on candidate 1.0.6. Installed 1.0.5 advertised rule version 3, but the Host API exception prevented live capability verification.
- [ ] Obtain repeated successful metadata reads and verify no GET-side storage initialization or timestamp change.
- [ ] Verify assignment/native State separation, exact receipts, harmless replay, changed payload with reused ID and stale revision rejection.
- [ ] Verify parent and leaf rollups, retained parent assignment and exactly one same-revision concurrent writer.
- [ ] Verify reload/fresh-page persistence, external State edits via MCP and child restoration to Done.
- [ ] Verify actual transaction rollback with unchanged metadata, native State and timestamp plus the intended exception marker or native app logs. Local VM exception tests do not simulate native transaction rollback.
- [ ] Verify positive Standby and Awaiting Testing behavior in a separately approved compatible schema. NPCD lacks these State values; its bundle must remain intact.
- [x] Compare final MCP fixture records against the new baseline. Fresh MCP reads after stopping the capability probe exactly match the original baseline, including timestamps. No fixture write was sent. Developer acceptance did not touch PMON or desktop data. The separately authorized desktop correction and normal PMON sync are recorded in STANDBY-METADATA-REPAIR.md; production sharing and credentials remain intact.
- [x] Prepare a concrete version/checksum handoff and preserve all earlier ZIPs and evidence.

## Candidate and verification limits

JetBrains [Custom Scripts](https://www.jetbrains.com/help/youtrack/devportal/custom-scripts.html) documents reusable values on the exports object. The 1.0.5 utilities instead assign module.exports. A local VM exposing require/exports without Node globals reproduces ReferenceError: module is not defined on the original utilities. The 1.0.6 acceptance archive converts only these export statements. This supports a compatibility candidate; it does not prove that missing module is the tenant's HTTP 500 cause. The empty native app log provides no server stack trace.

The candidate logs unexpected module-load and handler exceptions and rethrows them; it never converts an unexpected write failure to a successful response. Normal validation/conflict errors retain their existing status handling. Logs do not explicitly include tokens, request bodies or notes. The test-only fault endpoint logs its intended marker after both deliberate changes and then throws. Native rollback and log persistence still require live acceptance.

The fixed global Host API request supplies an explicit options object. Its regression invokes the actual Run-button callback and formatter, checks the options seen by a strict SDK stand-in, then rejects the metadata GET and verifies the displayed failure, enabled buttons and absence of POST calls.

Acceptance 1.0.6 SHA-256: 7ff2b4c4fa9d34592cdcd8c6cce25e63025ab7960e8668bd2894f53dd8bfb659. Nine-entry ZIP CRC, manifest/widget resolution, exact fixture/summary guards and exports/log contents are independently checked. The production 1.0.4 ZIP and historical acceptance 1.0.4/1.0.5 checksums are preserved. The candidate utility export/logging changes remain acceptance-only. The separately requested Standby correction updates production source to 1.0.5/statusRules 4; that new archive remains uninstalled.

Final type checking, zero-warning lint, 132 unit tests, eight worker/build checks and production build passed. The final complete browser matrix passed 198 tests with two expected mobile layout skips in 7.0 minutes; see STANDBY-METADATA-REPAIR.md. These use synthetic adapters and an exports-only Node VM, not the native GraalJS runtime, live server transactions or physical devices.

Raw evidence is private under artifacts/live-acceptance-1.0.5-2026-10-23/: MCP baseline/final JSON, zero-byte exported log, native failure screenshot and browser-evidence.txt. The user-facing administrator message is artifacts/romdex-admin-followup-1.0.6.txt.

## Review

What this change does: Corrects the deployed SDK's missing-options failure, packages utilities against the documented exports object and makes unexpected acceptance errors visible in app logs. Reviewed source transformations, exact fixture guards, error rethrows, preserved historical production archive, import boundaries and actual Run-button refusal formatting. The VM test intentionally leaves its synthetic fault mutations visible because it has no transaction engine; that is not a rollback pass. Looks good for the isolated candidate. Live acceptance remains blocked by installation and the unresolved HTTP 500.
