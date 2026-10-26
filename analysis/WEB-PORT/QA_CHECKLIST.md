# Web port QA checklist

Live application: `beab9b784500b16b23f54de99592019830945803`; Vercel `dpl_3cXZEbd1HvTnjE6GNDSbcqftgDGs`, Ready at https://romdex-web.vercel.app. Evidence checkpoint: `6aa159c2f405f491da57014beac0a05a637ee563`. Reconciled October 26, 2026 (America/New_York).

[Working queue](WORKING_QUEUE.md) | [Build](BUILD_CHECKLIST.md) | [QA](QA_CHECKLIST.md) | [Repair](REPAIR_CHECKLIST.md) | [Full acceptance inventory](../../docs/PORT-ACCEPTANCE.md)

Remaining: **16 unchecked actions**, 8 checked evidence-backed actions. Counts describe this report, not percent complete or an estimate.

Current task: evidence reconciliation. Next native work: verify the accepted SC-001 redesign; prepare the remaining task-first checks without claiming them passed. Full parity QA follows the associated implementation.

## Evidence already available

- [x] Q01 October 26 live application source passes type checking, lint, 135 application tests, 30 worker/backend tests and production build. Local worker 1f821e774c62812122b2 has 74 assets; this is not a claim that Vercel produced identical bytes. [Label report](../../docs/DEBUGGING-LABEL.md).
- [x] Q02 Existing task/status/filter browser checks on that source passed 38 cases with two expected mobile geometry skips across all five configured profiles. This is a focused suite, not a new full-port matrix.
- [x] Q03 Fresh Chromium and Firefox local and hosted checks verify Debugging selection, red accessible lamp, filtering, unchanged native State and unchanged Critical priority. No external service requests occurred. [Label report](../../docs/DEBUGGING-LABEL.md).
- [x] Q04 QUALIFIED PRESUMPTIVE PASS for preservation of previously verified hosted security/offline/update behavior. The October 25 hosted suite passed 34 cases on 36e748e; comparison through beab9b7 changes only src/components/romdex/task-properties.tsx, src/domain/accepted/core.mjs (red display string only), and src/domain/task-filters.ts among runtime/dependency paths. No worker, caching, transport or persistence code changed. The full 34-case hosted suite was not rerun on beab9b7. [Resume evidence](../../docs/MIGRATION-RESUME-2026-10-25.md).
- [x] Q05 Actual authenticated PMON reading was observed in native Chrome: 396 tasks were previewed, without importing the owner's workspace. Later Chrome/Firefox native quarantine reads also passed. The old preview's current retention was not established and its count is not a current production inventory.
- [x] Q06 QUALIFIED PRESUMPTIVE PASS for preserved native attachment behavior: Chrome PMON-467 and Firefox PMON-468 upload/exact-byte download/reviewed deletion passed; Firefox's interrupted upload was recovered by exact readback without resend, followed by a fresh passing cycle. Tests ran on 36e748e. The three later label changes leave attachment transport/storage and values unchanged; Q02-Q03 cover affected UI paths. Native attachment operations were not repeated on beab9b7. [Detailed evidence and limits](../../docs/NATIVE-ATTACHMENT-ACCEPTANCE-2026-10-25.md).
- [x] Q07 Native acceptance app 1.0.11 with preservation to 1.0.12 verified serial assignment/effective State, replay, reused IDs, stale revision, persistence and correlated rollback. Only those results pass; simultaneous writers failed and remain SC-001. App 155-84 was last verified Active on NPCD only on October 24, not reinspected during this report. [Native results](../../docs/LIVE-ACCEPTANCE-2026-10-24.md).
- [x] Q08 Desktop label installation has an isolated UI pass, exact installed-source hashes and a complete verified 134-file backup with every profile file unchanged. This is not user-observed desktop reopening or live sync acceptance. [Label report](../../docs/DEBUGGING-LABEL.md).

## Task-first cutover checks still open

- [ ] Q09 BLOCKED by B10-B11: prove concurrent shared-status writes, identical/reused operation IDs, stale/offline edits, exact lost-response receipts and correlated native State behavior under the agreed contract. Test actual success/conflict/recovery messages across independent browser/device sessions. The current contract requires one winner and one explicit conflict; a changed contract needs approval and new criteria.
- [ ] Q10 UNRUN natively through the web UI: create disposable tasks under the private test-only PMON epic, verify returned-ID/descendant mapping, persisted title/notes and no duplicate creation after uncertainty. Synthetic structural tests already exist.
- [ ] Q11 UNRUN natively through the web UI: edit notes across focus, explicit Save and an in-flight save; verify the final full text survives and genuine external differences still trigger review. Expected manual success: "Queued supported changes confirmed by YouTrack. Auto-Sync preference unchanged."
- [ ] Q12 UNRUN natively through the web UI: post/read back a synthetic comment, with exact task/draft scope and lost-response review that never automatically reposts.
- [ ] Q13 UNRUN natively through the web UI: reparent safe synthetic descendants, preserve hierarchy, reject cycles and review interrupted detachment. Exercise the actual confirmation/refusal path.
- [ ] Q14 UNRUN natively on appropriate private PMON fixtures: positive Needs Testing/amber inheritance and at-least-two Standby rollup, single-child/mixed exceptions, retained parent assignment and leaf choice. NPCD's State values did not establish these positive native branches.
- [ ] Q15 UNRUN natively through the web UI: reviewed child-first task deletion, exact target list, Cancel/no mutation, changed-child/baseline refusal and explicit missing/access ambiguity review. Never delete production tasks or existing acceptance fixtures for this check.
- [ ] Q16 PENDING bounded native delivery acceptance: verify actual PMON workflows/permissions and representative latency/error behavior for the final implementation. Preserve synthetic coverage for unexecuted rate-limit, quota, hidden-link and permission variants; document limits rather than manufacture failures or change tenant settings.
- [ ] Q17 UNRUN: actual Windows Chrome installation, OS shortcut launch, correct origin, retained local work, offline/reopen, update prompt and suspension behavior. Emulated standalone mode is insufficient. [Installation record](../../docs/WINDOWS-INSTALL-ACCEPTANCE-2026-10-25.md).
- [ ] Q18 UNRUN: equivalent Windows Firefox installation/launch checks on the owner's installed distribution. Headless Firefox engine tests are not an installed-window pass.
- [ ] Q19 PENDING safety gates: close desktop; make a fresh full backup and verified portable export; preview real counts, notes, assignments, hierarchy, file bytes/references and conflicts. The October 26 backup protects the label update, not a future migration snapshot.
- [ ] Q20 PENDING Q19: reconcile outstanding desktop edits/uploads/comments against current YouTrack before reviewed import. Preserve original queues and prior browser recovery; never replay desktop actions as web requests. Import starts disconnected with Auto-Sync Off and must show "File verified locally. No cloud request was made." before approval.
- [ ] Q21 PENDING Q09-Q20: run checks/build and sufficient regression on the final cutover candidate, record preservation-backed reuse and unrun variants, then obtain owner acceptance of the PMON daily workflow and rollback plan. Existing desktop remains available; production sharing is not enabled as an incidental test.

## Full-parity acceptance after first cutover

- [ ] Q22 Accept all remaining task-property, comments, drag/group/multi-select, task-image and keyboard/visual interactions after their implementation; inspect real error/message selection paths, not only internal state.
- [ ] Q23 Accept completed NPCDex authoring/content sync and managed RDX plans/packages/handoffs, including independent provider failure, stale revisions, quota and recovery. Current browse/draft/local-library tests do not prove these features.
- [ ] Q24 Accept remaining browser file/lifecycle equivalents and real mobile/iPhone/iPad installation/storage/suspension/update behavior where full-port scope requires it. Physical mobile acceptance is not a Windows day-one gate.

Evidence dates and candidate identities above are deliberate. This reporting turn did not run new tests, mutate YouTrack, install anything or read desktop task content. Unsupported concurrency has no presumptive pass.

Side-pane request: open_in_codex returned queued on October 26; this report was not confirmed visible.
