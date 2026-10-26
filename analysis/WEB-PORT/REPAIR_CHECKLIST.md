# Web port repair checklist

Live application: `beab9b784500b16b23f54de99592019830945803`; Vercel `dpl_3cXZEbd1HvTnjE6GNDSbcqftgDGs`, Ready at https://romdex-web.vercel.app. Evidence checkpoint: `6aa159c2f405f491da57014beac0a05a637ee563`. Reconciled October 26, 2026 (America/New_York).

[Working queue](WORKING_QUEUE.md) | [Build](BUILD_CHECKLIST.md) | [QA](QA_CHECKLIST.md) | [Repair](REPAIR_CHECKLIST.md) | [Full acceptance inventory](../../docs/PORT-ACCEPTANCE.md)

Remaining: **4 unchecked actions**, 8 checked evidence-backed actions. Counts describe this report, not percent complete or an estimate.

Open confirmed port defect: **1 (SC-001)**. Current task: record the vendor finding and update dispositions. Next repair action: R01 design decision. No additional administrator install is requested.

## SC-001: concurrent shared-status updates can silently overwrite each other

Owner: Main Agent; platform evidence: JetBrains support ticket 9288924 and JT-98787. Native failure: NPCD-873 admitted two same-revision writes, retained one receipt, and reported both requests successful. Root's passing race and serial mocks do not negate this failure.

- [x] Preserve the original failing native pair and successful serial/rollback controls. [October 24 evidence](../../docs/LIVE-ACCEPTANCE-2026-10-24.md).
- [x] Submit the support packet and receive a substantive answer. October 26 response confirms no app compare-and-set/lock/conditional-header support, commit-time read validation/retry or app-owned unique-record primitive. Updating an extension property does not advance the issue updated timestamp. No supported fix/workaround was offered. [Reply and source](../../docs/JETBRAINS-SUPPORT-REPLY-2026-10-26.md).
- [x] Record the response as a confirmed design limitation, not an unresolved permission/installation problem. The reply monitor was deleted after notification. Keep production metadata source 1.0.8 withheld and sharing disabled.
- [ ] R01 BLOCKED on design decision: select an approach that preserves required safety. External transactional coordination/storage would change the standing YouTrack-only backend constraint and requires explicit approval. An intent/conflict-history design would change success/reconciliation semantics and still needs feasibility proof. No reduced-safety single-browser workaround was approved.
- [ ] R02 PENDING R01: implement and consolidate the approved replacement plus explicit old-record/queue migration and recovery rules. Retain existing fixture storage and receipts; do not overwrite metadata merely to restart testing. Tracked as B11.
- [ ] R03 PENDING R02: run the smallest discriminating native concurrency and exact-receipt tests, then affected client/rendered-message checks. One successful race is not a guarantee. Follow the revised contract only if approved; tracked as Q09.
- [ ] R04 PENDING R03 and other cutover gates: prepare any final app package/configuration change, verify project/permissions, and enable production sharing only in the reviewed migration. A package is not requested now.

## Prior repairs and scope limits

- [x] Native API field access and request-stream parsing repaired, with bounded live confirmation and correlated rollback. Preserve original failures and package provenance. [Native acceptance](../../docs/LIVE-ACCEPTANCE-2026-10-24.md).
- [x] Notes focus/in-flight-save safeguards, status popup close controls and filter expansion repairs delivered. Existing evidence retains its original dates; no new live sync pass is claimed here. [Notes](../../docs/NOTES-SYNC-CORRECTION.md), [popup](../../docs/STATUS-DIALOG-REPAIR.md), [filters](../../docs/TASK-FILTERS.md).
- [x] Hosted pane/dialog/menu/header repairs and chevron removal delivered. Debugging label deployed and desktop data preserved. [UI](../../docs/UI-REPAIR-2026-10-24.md), [label](../../docs/DEBUGGING-LABEL.md).
- [x] NA-001 interrupted Firefox attachment test has a resolved exact receipt, safe readback without resend and fresh passing cycle. The original missing-confirmation observation stays failed/historical; timeout is a supported hypothesis, not a proven application defect. [Native attachment report](../../docs/NATIVE-ATTACHMENT-ACCEPTANCE-2026-10-25.md).
- [x] Classify Windows installation as pending acceptance, not a confirmed app defect: desktop movement/user activity stopped UI automation before installation. [Windows record](../../docs/WINDOWS-INSTALL-ACCEPTANCE-2026-10-25.md).

The separate YouTrack MCP comment-write incident CONNECTOR-01 is not established as the same bug. Probes passed while the earlier read-only-transaction errors remained real; its cause is unresolved in [the connector diagnosis](../CONNECTOR-2026-10-25/DIAGNOSIS.md). Do not turn that tooling incident into a new port repair or claim it resolved from SC-001's answer.

Side-pane request: open_in_codex returned queued on October 26; this report was not confirmed visible.
