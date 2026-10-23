# Consolidated YouTrack repair and QA

Requested October 23, 2026 after repeated administrator updates. The earlier 1.0.6 acceptance handoff is withdrawn. No new installation request will be made in this task. Preserve the installed desktop app, profiles, credentials and normal sync. Existing attachment work stays separate.

## Requirement checklist

- [x] Reproduce the earlier missing Host API options and Node-only export assumption with executable regressions; check documented server APIs.
- [x] Validate both manifests, widget-relative assets, unchanged extension storage, scope families, exact NPCD-872/873 summary guards and read-only GETs.
- [x] Run complete packaged root/leaf button flows: assignment/native State separation, exact receipts/replay, reused IDs, stale revisions, concurrency refusal and reload.
- [x] Exercise registration, permission, malformed/empty responses, incompatible protocol, missing State, corrupt storage, escaped exceptions and overlapping actions.
- [x] Exercise rollback preconditions and simulated transaction exceptions. Empty native error bodies remain PENDING until a matching post-mutation log marker is verified.
- [x] Keep the two-child Standby threshold and testing precedence unchanged. No desktop installation is needed for this follow-up.
- [x] Preserve earlier archives and refuse overwriting different bytes under the same version.
- [x] Diagnose browser recovery failures found by the full matrix and make fault injection target the intended editor save. Existing browser storage protections remain unchanged.
- [x] Finish the final complete check/build/browser matrix and record each result below.
- [x] Installed desktop repair-file hashes match the preceding checkpoint. No desktop-data or credential path was written.

## Repairs

Both server utilities now use the documented exports object directly. Production and acceptance use identical utility source; the acceptance builder no longer rewrites exports. Explicit Host API scope options are supplied.

JetBrains apps-tools 1.0.3 rejected the backend-only production manifest's empty widgets list. The repaired manifest omits that optional property. The acceptance widget retains its correct widgets/acceptance HTML and module paths. Extension property names and types are unchanged.

The widget disables controls until SDK registration succeeds and while a request is active. All controls check app identity, protocol and rule version before issue access. Invalid snapshots and null/string/numeric/empty error shapes display readable failures. Root Run checks that the child is restored to Done, including its assigned choice, before any write.

Concurrency requires exactly one success, one HTTP 409 loser and the winner's exact receipt, revision and assigned value. A server error cannot count as a conflict pass. Lost assignment responses are never automatically resent.

Rollback requires initialized metadata, a non-Open State and a UUID marker. The marker is logged after both deliberate mutations, before throwing. The widget compares the full before/after snapshot, rejects a successful response or persisted mutation, and displays PENDING when YouTrack's empty exception response cannot confirm the marker. Its matching app-log entry remains required.

Archive construction can run in memory. Tests no longer write release ZIPs as a side effect. Archive/checksum publication refuses differing existing bytes. Intermediate, never-distributed ZIPs are retained separately as QA evidence.

The first complete run exposed a fault-injection sequencing error in two recovery tests. Navigation/selection writes were sometimes still pending when the tests installed an IndexedDB abort hook. The app could therefore enter its deliberately inert save-error state before the attempted fill, so the failure did not establish loss of an accepted note edit. Both tests now wait for the actual saved-state message before injecting failure. NPCDex also checks a text/flag interaction before its Save action. An added select locator was corrected to use the native combobox role. Investigation-only browser behavior edits were backed up and removed; storage-error, stale-window, failed-load and delivery protections remain byte-identical to the preceding checkpoint. Failed traces are retained. Final repeated-path and full-matrix results are recorded below.

## Evidence and release gate

Both exact extracted archives passed the pinned official JetBrains validator. Its printed success was checked because errors can still return exit status zero. CRCs, six/nine entries, source bytes, asset resolution and deterministic rebuilds pass.

- Production source 1.0.6 SHA-256: 2fe40c63eb807176e90634834eadf1ed46cb48e2d487002d7634dc8102ea591e.
- Acceptance source 1.0.7 SHA-256: 8c4b87b61536f5e9165e3eecf5b88c748093105f9036370302a4678bb06ff50e.
- These are local QA candidates, not installation instructions. Earlier archives remain intact.
- All 19 consolidated archive/backend/widget tests pass, including a clean source-only checkout. They require no downloaded JetBrains tooling or ignored historical ZIPs.
- The initial application check passed 129 unit tests and 27 Node checks (19 YouTrack plus eight worker/build). Final pnpm check passed type checking, zero-warning lint, 129 unit tests and 27 Node checks (156 total).
- The final build passed with 75 shell assets (worker inventory 83164a222ac068361901); the investigated browser application files are restored. Its first browser run was 211 passed, two failed, two expected mobile layout skips; that diagnostic run is not final acceptance.
- Rendered widget tests load the exact ZIP HTML/module, route calls into its handlers, and check full Run/reload/rollback, empty HTTP 500, registration refusal, disabled states, mobile width and uncaught errors across all five browser targets.
- Fresh MCP reads of NPCD-872/873 exactly match the prior baseline, including timestamps and visibility. This task made no live issue writes.
- Installed desktop core SHA-256 remains b4242431b32a998e4d3e09bcc4b9f8dee91f7ab89c1fba28e3271dc709256a0c; GitHub metadata store remains 29e4f2d74e28b236761337b3aaff55c77371bbd35d59beebe5b7773383ad4707. No desktop profile was copied, edited or used as a test.

Private evidence is under artifacts/youtrack-qa, including official validation, failed traces, clean-checkout output and live MCP readbacks. The source and tests are committed evidence; user data and downloaded tools are excluded.

## Review

What this change does: Consolidates compatibility fixes and exercises the full packaged frontend/backend flow before another administrator request. Review traced imports, archive construction/readers, actual callbacks and messages, fixture boundaries, retained storage, status rules and exception propagation. Review also caught and removed a mandatory-test dependency on ignored historical archives.

The expected load is a controlled two-fixture test and ordinary multi-device app use. The local dispatcher simulates commit/abort. It does not establish native transaction isolation, hidden-link visibility or workflow effects. The browser recovery investigation preserved existing product behavior and corrected the test preconditions. Stale-window, failed-load and storage-error protections remain.

## Native checks remain pending

- [ ] Verify repaired metadata reads in the tenant's actual runtime; the installed app remains 1.0.5 and its HTTP 500 cause is not confirmed by native logs.
- [ ] Verify real concurrent transaction isolation, workflow interaction and independent-device persistence.
- [ ] Verify native rollback with an unchanged snapshot and the correlated post-mutation log marker.
- [ ] Verify positive Standby/testing with an independently authorized compatible schema; NPCD's State bundle stays intact.

Node VMs, browser emulation and schema checks cannot establish these native results. No new installation, permission grant, environment creation or production cutover is requested.

## References checked

[Host API](https://www.jetbrains.com/help/youtrack/devportal/apps-host-api.html), [HTTP handlers](https://www.jetbrains.com/help/youtrack/devportal/apps-reference-http-handlers.html), [custom script exports](https://www.jetbrains.com/help/youtrack/devportal/custom-scripts.html), [extension properties](https://www.jetbrains.com/help/youtrack/devportal/apps-extension-properties.html), [Project](https://www.jetbrains.com/help/youtrack/devportal/v1-Project.html), [Issue](https://www.jetbrains.com/help/youtrack/devportal/v1-Issue.html), [BundleProjectCustomField](https://www.jetbrains.com/help/youtrack/devportal/v1-BundleProjectCustomField.html), [Set](https://www.jetbrains.com/help/youtrack/devportal/v1-Set.html) and [official local tooling](https://www.jetbrains.com/help/youtrack/devportal/js-workflow-external-editor.html). Optional workflow typings were inspected; their HTTP response interface differs from the current documentation, so they are not proof of native behavior.

The corrected recovery scenarios passed all 12 repeated runs on WebKit and iPhone (three repetitions of each scene per target, 38.9 seconds) with existing browser behavior. The final complete five-target matrix passed 213 checks with two expected mobile desktop-layout skips in 7.0 minutes. No source changed during that run.

Final verification: pnpm check passed 129 unit tests plus 27 Node checks, type checking and zero-warning lint. The production build passed. The final five-target browser matrix passed 213 tests with two expected mobile layout skips (7.0 minutes). The two corrected recovery scenes also passed 12 repeated WebKit/iPhone runs. The 19 archive/backend/widget scenarios passed from a clean source-only copy. Both frozen candidates passed the official manifest validator. The installed desktop and both live fixtures remain intact. No native deployment or installation request was made.

Review verdict: the local source checkpoint is ready. Native runtime and transaction acceptance remain explicitly pending; production sharing stays off and the candidate is withheld.
