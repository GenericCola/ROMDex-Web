# Web port working queue

Updated October 26, 2026. One active work item: reconcile port build/QA/repair documentation and report the sitrep. No new application development or cloud mutations are part of this item.

| Order | Work item | Disposition / dependency |
| --- | --- | --- |
| 0 | User request: update build/QA/repair docs and explain remaining port work | Documentation complete: counts and links verified, source preservation checked, three side-pane requests queued; sitrep prepared for this turn. |
| 1 | SC-001 shared-status contract/storage decision | Vendor answer received; existing method cannot meet concurrency guarantee. Needs a design decision, not another install. B10 / R01. |
| 2 | Implement approved shared-status design and prove it natively | Depends on 1. B11 / Q09 / R02-R03. |
| 3 | Complete representative native PMON task workflow acceptance | Quarantined test-only descendants; no production work used as tests. Q10-Q16. |
| 4 | Verify Windows app installation/lifecycle in Chrome and Firefox | Q17-Q18. Preserve existing tabs, drafts and desktop fallback. |
| 5 | Fresh backup/export, reconcile pending work, review/import and accept cutover | Q19-Q21; after safety gates. No queue replay. |
| 6 | Finish accepted task/NPCDex/RDX parity after initial PMON move | B12-B27 / Q22-Q24. Not permission to add unshipped prototype features. |

[Build checklist](BUILD_CHECKLIST.md), [QA checklist](QA_CHECKLIST.md), [Repair checklist](REPAIR_CHECKLIST.md). The full requirement inventory is [PORT-ACCEPTANCE.md](../../docs/PORT-ACCEPTANCE.md).

Completed latest change: Debugging label installed on desktop and deployed on Vercel; exact source beab9b784500b16b23f54de99592019830945803, evidence checkpoint 6aa159c2f405f491da57014beac0a05a637ee563. Full desktop profile preserved. This change did not migrate the owner's workspace or enable production sharing.

Verification: all new report links resolve; listed checked/unchecked counts match; git diff contains no runtime/dependency change. No tests, cloud writes, deployment, desktop installation or data migration ran for this reporting task.
