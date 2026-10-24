# Native YouTrack acceptance, October 24, 2026

The new system privilege works. The acceptance app was updated in place without
administrator action. The final installed checkpoint is 1.0.12, app ID 155-84,
Active and attached only to active NPCD. Production sharing remains off.

## Requirement checklist and evidence

| Requirement | Result |
| --- | --- |
| Retry the frozen 1.0.7 package after the privilege grant | PASS. Same app ID, successful upload, version and activation verified in the native UI. |
| Preserve project boundaries and existing data | PASS. NPCD-only attachment retained; no role, field bundle, workflow, CORS or PMON changes. Desktop code/data were not written. |
| Begin with repeated read-only checks | PASS on repaired handler. Root revision 0, uninitialized, Open, unchanged timestamp on repeated GET. Child revision 0, uninitialized, Done. |
| Repair the native Project.State error | PASS. Use issue.fields permission methods. Actual 1.0.7 server log reproduces the Project property error; API fixture now reproduces it too. |
| Repair rejected POST parsing | PASS. Cache request.body once and parse the cached string. Repeated reads consumed the native stream before json(). The earlier log's zero length was observed after parsing, so it did not establish an empty incoming request. Explicit JSON headers alone did not fix it. |
| Own assignment versus effective native State | PASS on root and child. Root assignment In Progress remained separate while its Done child produced native Done. |
| Exact receipt, replay, reused ID and stale revision | PASS on both fixtures through the native widget. Replay performed no write; changed/reused IDs and stale revisions returned 409. |
| Same-revision concurrency | FAIL. Root admitted one writer and one 409 loser. Child admitted both writers. The panel correctly displayed FAIL. Shared metadata is unsafe for production until this is repaired and repeatedly retested. |
| Independent fresh-page persistence | PASS for root revision 3 and its exact receipt, assignment, native State and timestamp. This is a fresh page, not a physical-device test. |
| Correlated native rollback | PASS on root. Complete metadata, native State and timestamp stayed unchanged. Downloaded server log contains the exact post-mutation marker d5210887-ebff-4795-adcf-79ad91c7ea27 at 16:13:05.984 UTC. |
| External native edit and fixture restoration | PASS. MCP restored only child NPCD-873 to Done. App readback reports both native and assigned Done, retains its revision/receipt, and reflects the new native timestamp. Root remains native Done. |
| Preserve extension storage during final update | PASS. Both revision-3 snapshots, receipts, assignments, States and timestamps match exactly after the final 1.0.12 upload. See native-results.json. |
| Immutable archives and official validation | PASS. Earlier ZIPs retained. Exact final archives pass the pinned JetBrains validator. |
| Complete local checks/build/browser verification | PASS. Type checking/lint, 133 application tests plus 29 Node checks, static build, 15 focused widget browser checks and final five-profile matrix (233 passed, two expected mobile layout skips, 7.6 minutes). Earlier run had a Playwright trace-file collision caused by overlapping test invocations and is not final acceptance. |
| Private backup and closure preservation | Source, exact packages and unique native/local QA evidence are included in this private checkpoint. Remote commit verification is recorded in artifacts/youtrack-qa/native-2026-10-24/backup.json. This branch remains in development; zero cleanup moves/deletions or pruning. Preserve unrelated unfinished attachments and all ROM work. |

## Frozen packages

- Acceptance 1.0.12: SHA-256
  6f3cc6881dbbdccd51c98407d85da03119e45269f19ed7cd67bf43b53dfdd063.
- Production source 1.0.8: SHA-256
  07d936f6751f99ae2067abd01f8d4e54c62400c1300a4d0d0dbd1938b9f342fb.
  Withheld. Do not install it on PMON or enable sharing.
- Native functional write/rollback testing ran on 1.0.11. Independent archive
  comparison proves 1.0.12 changes only the manifest version and removes
  temporary expected-error body-inspection logging. Functional handler,
  utilities, extension schema, widget and rollback code are otherwise identical.
  Final 1.0.12 metadata reads also confirm exact retained storage.

The native concurrency failure disproves the local stand-in's serialization
assumption. Its Node dispatcher executes transactions sequentially and cannot
prove native isolation. Passing local tests and the root race do not override
the child failure. Next work must provide a supported atomic update mechanism
or revise the shared-status persistence design, then repeat real overlapping
requests. A process-local JavaScript lock or another check before the same
unprotected property write is not evidence of a safe fix.

No production app was installed. Existing PMON issues, desktop code/data,
credentials, workflows and project schemas remain intact. The final test app
stays limited to the two synthetic fixtures and retains their receipts.
Positive Standby/testing cannot be verified with NPCD's existing State values.
Other-user/hidden-link behavior, sustained concurrency, physical devices,
real-origin CORS and production cutover remain pending.

The owner selected Vercel for eventual hosting. Deployment waits for the release gates. The final website origin,
configuration and YouTrack CORS approval remain pending.

Official references checked:
[Fields](https://www.jetbrains.com/help/youtrack/devportal/v1-Fields.html),
[Host API](https://www.jetbrains.com/help/youtrack/devportal/apps-host-api.html),
[HTTP handlers](https://www.jetbrains.com/help/youtrack/devportal/apps-reference-http-handlers.html).

## Review

What this change does: repairs native custom-field access and consumes each
incoming JSON body once. The acceptance transport declares JSON explicitly;
test fixtures now distinguish Project properties from custom Fields and model
a consumed request stream. All callers and three older unit fixtures were
updated. Permissions, body-size validation, fixture guards and escaping
transaction errors remain intact. Expected use is ordinary multi-device work,
so the observed two-writer race blocks release even at low load.

Local review found no remaining issue in the bounded API/parsing repair.
The shared-status transaction design still needs a concurrency repair.
No production-release approval is implied by this checkpoint.

Final review verdict: the bounded API/parsing repair and native evidence are ready for a private checkpoint. Production sharing remains blocked by the observed native concurrency failure. Local mocks, browser profiles and a single successful root race do not establish native serialization.
