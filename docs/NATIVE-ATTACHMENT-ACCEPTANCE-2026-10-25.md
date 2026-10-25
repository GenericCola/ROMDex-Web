# Latest native QA status — Chrome and fresh Firefox happy paths PASS

Fresh Firefox runfirefox-20261025-c passes the bounded native attachment happy path on quarantinedPMON-468. Chrome's prior happy path and Firefox exact-recovery discriminator also pass. The original NA-001 interrupted-upload observation/result/screenshot/recovery retain their failed/historical disposition; no earlier run is relabeled passed and no production app defect is proven.

Main Agent executed one newly planned unique-file run after resolving12-3400; it was not a resend of that upload. Current test runner6427dd3cdb59f3af55e240e7e9a88c23af068c3ed9ff5ed02e177ada09da858c changes ordinary assertion/page timeout to30seconds, app/guard unchanged. Wrapper metadata records exit0. App source remains36e748eaad7e360974c62c392a61c639ae19f804, hostedworkerab1f7919250cf0cbbfa8 as reconfirmed by Main Agent. BrowserFirefox157.0 is Playwright's engine in a fresh isolated context, not physical Firefox OS installation. Runtime17,074ms. Test-QA Agent reviewed completed evidence only; no browser/live request/credential access/test/source edit.

| Fresh Firefox acceptance | Disposition/evidence |
| --- | --- |
| Actual native quarantine read/import/select | Pass: native three-task200/CORS receipt PMON-466/467/468; actual3-task read message, completed import/selection assertions, recoveryselected468/parent466; syntheticTaskContextfalse. |
| Disconnected stage/reload/export/recovery | Pass: actual stage/export messages and completed noPOST/reload assertions; before-delivery recovery contains oneuploadoperatione383365b-299f-49bb-9065-246b28c0e234, matching64-byte embedded data, no deliveryrecords, Auto-Syncfalse. |
| Account/baseline/setup | Pass: native account2-2, empty inventory and actual0attachment/setup messages; no unrelated queue operations in recovery. |
| One explicitSave/nativeupload/confirmedUI | Pass: onePOST200/CORS returning12-3401, metadata exact unique filename romdex-native-pmon-468-firefox-20261025-c.txt,size64,text/plain,author2-2; actual confirmedSave message recorded and visible in uploaded.png. Confirmed archived upload preserves empty prior-ID baseline and exactreceipt. |
| Native bytes/explicitdownload/CORS | Pass: two nativefileGET200/CORS and identical refreshed metadata; original/staged-export/native-download independently SHA-256891745daa299c4971d3a4f30de69cb0c914bea79690c8690003e47f419b975b1. Actual verified-current-metadata download message visible. |
| Cancel/reviewedqueue/noDELETEbeforeSave | Pass through completed dialogidentity/name/size/permanence and zeroDELETEassertions; queue message recorded. No separate intermediate dialog screenshot, so not claimed independently frame-verified. |
| One exact revieweddelete/nativeabsence | Pass: oneDELETE200/CORS only12-3401, nativeemptyinventory and second actual confirmedSave message. Final recovery has confirmeddeleteoperation2aad13db-db58-4cf2-8931-b3640cafba59,empty operations/uploads/missingUploads/attachmentinventory. |
| Disconnect/reload/OFF | Pass: actualdisconnect message, completed noDownload/OFF assertions, finalAuto-Syncfalse/no sharedStatuses enabled; deleted-reloaded frame shows empty attachment/queued-request area. |
| Fixture preservation | Pass forselectedPMON-468: direct supplied before/afterMCP comparison changes onlyupdatedAt; originaltext,parent,fields,visibility and emptyattachments unchanged, consistent with firefox-preservation.json. Otherquarantinefixtures were last verified empty/preserved in recovery review; this fresh final snapshot is selectedchild only and does not independently resnapshotallthree. Guard excludes their writes. |

Actual uploaded.png reviewed: selected PMON-468, quarantineparent, actualSaveconfirmation and verifieddownloadstatus; exact64-byteID12-3401/file/download/remove controls are legible, Auto-SyncOFF. Actual deleted-reloaded.png reviewed: samefixture,parent and OFF state, visible emptyfile/request area with no leftover diagnostic entry. No rendered defect observed.

Evidence: artifacts/native-attachments-2026-10-25/firefox-20261025-c/result.json,twoPNGframes,before-delivery-recovery.json,final-recovery.json,originalfile,staged-export.txt,native-download.txt; parentfirefox-20261025-c-metadata.json,pmon-firefox-final.json,firefox-preservation.json; before snapshotpmon-recovery-after.json. The result's MCP-pending text predates Main Agent's later readback, reviewed here.

Upload-to-download phase boundary is10,852-5,640=5,212ms; this is consistent with a5-second assertion limit being insufficient in the original run, but does not prove its exact cause. No app code was changed to obtain this pass. NA-001's preserved operation is safely resolved and this fresh happy path now passes; retain the original evidence and uncertainty.

Remaining gates/limits: installedChrome native attachment happy path passes; Firefox native browser-engine happy path and recovery pass; no production task mutation or desktop migration is accepted by these findings. Native additionalerror/conflict/limitbranches, physicalWindowsinstallation, SC-001concurrency, owner acceptance and desktopbackup/export/import/cutover remain pending. Cancel/queue cases rely on completed assertions as disclosed. No required evidence is missing for this bounded fresh run. Sol/medium reused based on prior correct evidence reviews; no measured token-savings claim.

---

# Latest native QA status — NA-001 recovery PASS

The preserved Firefox operation is now resolved by native exact readback without resend, followed by reviewed deletion. Chrome happy-path acceptance remains passed. The original Firefox upload-completion interruption remains a failed acceptance observation; this recovery does not establish a clean Firefox upload happy path, the cause of that interruption or physical Firefox installation. Any new clean-upload check requires Main Agent's separate bounded decision.

Reviewed completed runfirefox-recovery-20261025-a once, runner SHA1a62f497df4c12495fa4ae5d31d129894e67f8ef1c3f2b7efd0790d38f1bab69, exit0 in wrapper metadata. App source36e748eaad7e360974c62c392a61c639ae19f804, supplied hostedworkerab1f7919250cf0cbbfa8. Firefox157.0 Playwright engine, fresh context, recoveryOnlytrue, total13,186ms. Main Agent executed; Test-QA Agent only read completed evidence and updated this document. No browser, credential/wrapper/process access, live request, test or source/harness edit by QA.

| Recovery acceptance | Disposition/evidence |
| --- | --- |
| Exact preserved input unchanged | Pass: original stopped-recovery SHA79ef8657d53d40be96fe8e213711c6fe99c6f35cddf8ca7d74891df6a66f7099 independently rehashed; result records same before/after SHA. |
| Actual UI import, disconnected/Auto-SyncOFF, uncertain review | Pass: actual `File verified locally. No cloud request was made.` message; imported-uncertain.png directly shows Uncertain delivery, interrupted warning, PMON-468 queued-change context, exact-ID/readback controls, empty session-token field and Auto-SyncOFF. |
| Same native account, exact receipt/readback without resend | Pass: account2-2 via200/CORS; actual Current attachment IDs message; readbackConfirmedtrue.13native receipts contain zeroPOST and one laterDELETE. Readback-confirmed recovery holds confirmedfb03c726-31c5-41c2-8018-3749640baf6d,remoteId12-3400, message `Exact attachment ID and bytes confirmed without resending.`,empty operations/uploads and current metadata for that exact file. |
| Actual bytes and authenticated CORS | Pass: twofileGET200/CORS receipts, metadata name/size64/MIMEtext/plain/author2-2/timestamps equal original receipt; native-download.txt independently rehashed equal original64-byte diagnosticSHA96b32b2ba21f7d946c18a2ad76262ab63bb2b45e8aaa78961f033835bd10f8b6. Actual verified-current-metadata download message recorded and visible in uploaded.png. |
| Cancel/reviewed queue with zeroDELETE before explicitSave | Pass by completed runner assertions required in frozen handoff; actual queue message recorded. Intermediate dialog/zero-count state has no separate screenshot; not independently frame-verified. |
| One exact deletion and confirmed absence | Pass: oneDELETE200/CORS only12-3400; following inventory/task200; actual confirmedSave message. Final recovery archives confirmed exactdeleteoperationda3bd11a-16eb-4c55-b518-0dc3021c4b81 and confirmed originalupload,empty operations/uploads/missingUploads/PMON-468 inventory. |
| Disconnect/reload/persistence | Pass: actual disconnect message; deleted-reloaded.png shows empty visible attachment/queued-file area and Auto-SyncOFF; final recovery has Auto-Syncfalse, no sharing enabled and no pending operation. |
| Quarantine preservation | Pass within supplied evidence: direct recovery-before/after snapshot comparison forPMON-468 changes only updatedAt and removal of its exact12-3400 attachment; other text/fields/parent/visibility unchanged. After snapshot contains allthree fixtures, all empty. Main Agent recovery-preservation.json separately records equal identity/text/hierarchy/fields/visibility/tags/comments/work/link counts for466/467/468. No claim of server-wide audit. |

Rendered evidence viewed directly: imported-uncertain.png has readable warning and both readback/stop controls within centered dialog; uploaded.png has PMON-468 selected and legible64-bytefile12-3400 with download/remove controls and actual download status; deleted-reloaded.png shows no file entry or queued request in the scrolled attachment area. No rendered defect observed. Some task titles are clipped to their narrow property field as in existing layout; exact identity is visible in pane/header and receipts.

Evidence directory: artifacts/native-attachments-2026-10-25/firefox-recovery-20261025-a/{result.json,imported-uncertain.png,uploaded.png,deleted-reloaded.png,readback-confirmed-recovery.json,final-recovery.json,native-download.txt}; parent firefox-recovery-20261025-a-metadata.json,pmon-recovery-before.json,pmon-recovery-after.json,recovery-preservation.json. Result's emitted MCP-pending phrase predates the later supplied preservation records. Frozen prerequisite is docs/NATIVE-ATTACHMENT-RECOVERY-HANDOFF-2026-10-25.md (57offline guard cases/syntax pass reported, not rerun by QA).

No required recovery evidence is missing. Cancel/queue timing relies on completed assertions rather than an intermediate frame, explicitly disclosed. Phase timings are cumulative boundaries and do not prove the earlier5-second-timeout hypothesis. Original stopped result/frame/recovery stay intact and retain their original disposition. Native Firefox clean upload, other error/conflict branches, OS installation, SC-001 concurrency and desktop cutover remain pending. No native retry or repeated upload was performed during recovery.

---

# Latest native QA status — Firefox NA-001 open

Chrome bounded acceptance remains passed. Firefox attemptb stopped at upload completion; overall Firefox native acceptance is incomplete. No repeated upload or DELETE ran. Main Agent's next authorized step is a separately reviewed readback-only recovery harness with everyPOST forbidden; QA awaits its frozen candidate/completion signal. Original failure artifacts remain unchanged.

## NA-001 — Firefox completion message not observed

Impact: acceptance-blocking interruption with one live diagnostic attachment left for exact readback; an application defect is not established. Candidate36e748eaad7e360974c62c392a61c639ae19f804, hostedworkerab1f7919250cf0cbbfa8 (Main Agent identity confirmation). Firefox157.0 is the Playwright engine in a fresh guarded context, not OS installation acceptance. FixturePMON-468 under private Test-onlyEpicPMON-466. Runfirefox-20261025-b; real native task context and responses, one occurrence; no blind retry.

Preconditions/steps recorded by completed runner: read/import actual three quarantine tasks; selectPMON-468; stage unique64-bytefile disconnected; reload/export; connectaccount2-2 with Auto-SyncOFF; read empty native inventory; explicitSave. Expected actual UI message: `Queued supported changes confirmed by YouTrack. Auto-Sync preference unchanged.` Observed result: STOPPED at upload with that message absent. stopped.png was directly reviewed and visibly shows `Delivering supported queued changes...`, selectedPMON-468 and Auto-SyncOFF. It does not display a confirmed upload/download.

Native evidence: onePOST200/CORS returned12-3400; refreshed metadata has filename romdex-native-pmon-468-firefox-20261025-b.txt,size64,MIMEtext/plain,author2-2,created1792950796859,updated1792950796817. One native fileGET200/CORS and subsequent taskGET200 are recorded. There is no explicit download artifact or second fileGET, and noDELETE. These receipts prove native upload/read traffic, not completed journal confirmation or full Firefox acceptance.

Stopped recovery preserves operationfb03c726-31c5-41c2-8018-3749640baf6d, upload bytes/hash96b32b2ba21f7d946c18a2ad76262ab63bb2b45e8aaa78961f033835bd10f8b6,account2-2,empty prior-IDbaseline,remoteId12-3400,statusuncertain and message `Delivery or confirmation was interrupted. Do not resend without review.` The exported uncertain status is preserved evidence; it does not prove the live app had independently reached that status before the harness stopped. Original/staged64-byte artifacts are listed; no native downloaded bytehash is claimed from this run.

| Firefox acceptance step | Disposition |
| --- | --- |
| Actual quarantine read/import/selection, cleared read form | Pass through completed-run assertions/message200/CORS record |
| Disconnected stage, reload, export and before-delivery recovery | Pass through recorded messages/assertions; stopped recovery retains bytes |
| Connect bound account2-2, Auto-SyncOFF, empty native inventory | Pass through setup/list messages and native receipts; OFF visible in screenshot |
| One native upload/exact receipt/metadata | Pass as transport observation, ID12-3400; confirmed-journal acceptance remains pending |
| Expected confirmedSave message/journal completion | Failed acceptance observation; cause undetermined |
| Explicitdownload and independent native-bytehash | Pending/unrun after stop |
| Cancel/reviewedqueue/zeroDELETE-beforeSave/exactdelete/absence | Pending/unrun; noDELETE occurred; live file retained for review |
| Disconnect/reload/emptyfinalqueue/recovery | Pending/unrun; stopped recovery deliberately retains uncertain operation |
| Fixture preservation | Main Agent plan reports MCP confirms singlefile12-3400 and unchanged other fields,parent,visibility; QA did not broaden this assignment to additional snapshot reads |

Evidence paths: artifacts/native-attachments-2026-10-25/firefox-20261025-b/result.json,stopped.png,stopped-recovery.json,original64-byte diagnostic and staged-export.txt. Main Agent analysis/authorized next discriminator: docs/NATIVE-ATTACHMENT-RECOVERY-PLAN-2026-10-25.md. Its proposed timeout boundary is a hypothesis, not a QA diagnosis or proven cause. No harness change, native action or test was performed by Test-QA Agent.

Attempta is a separate Main-reported launch/configuration stop before anyAPI: omitted browser-cache configuration, later corrected and credential-freeFirefox157 launch passed. It is not a failed upload and provides no native attachment acceptance. Attemptb remains the only Firefox native upload; do not retry it or bypass the now nonempty baseline.

---

# Latest formal QA outcome — native Chrome completed

PASS for the bounded happy-path native attachment acceptance on PMON-467. Firefox remains pending a separate Main Agent run/completion signal. This latest section supersedes historical blocked/unrun statuses below for the new owner-authorized PMON quarantine only; the prior NPCD alias path was never executed.

Main Agent executed frozen runner SHA-256207cc5a85e964fc2e2a18f888a32a1ad2b783ba5672fe152c0008a71dad9cc92 once; reported exit0. Test-QA Agent read completed sanitized evidence only and did not launch a browser/test, access wrapper/credential state or mutate cloud/source. Installed Chrome155.0.8059.85, fresh headless context; source36e748eaad7e360974c62c392a61c639ae19f804; hosted workerab1f7919250cf0cbbfa8 independently reconfirmed by Main Agent. BUILD44 offline guard cases and syntax review are separate prerequisite evidence, not native gameplay/UI results.

| Acceptance | Chrome disposition / evidence |
| --- | --- |
| Native identity/read/import/selection | Pass: real3-task200/CORS read contains PMON-466/467/468; no aliases/synthetic task context. Recovery holds only these three identities, selectedPMON-467 beneathEpic466. Runner required actual3-task message, cleared read token, Save3Tasks and actual child selection. |
| Disconnected stage/reload/export/recovery | Pass: exact staging/export messages recorded; original, staged export and native download each63bytes with independently reviewed SHA-25613ba0e7d8a2500acde886970a6941b76887db12bd3a9d1eee2375b3dcf32b361. Before-delivery recovery embeds matching staged bytes/hash, one upload operation, empty records and Auto-Syncfalse. |
| Session/account/empty baseline | Pass: real users/me200/CORS account2-2; actual setup and0attachments messages. Baseline confirmed empty before native upload. Token cleared was an assertion in completed runner, not credential inspection by QA. |
| One explicit upload/exact receipt | Pass: onePOST200/CORS to PMON-467/attachments, new ID12-3399, exact unique filename,63bytes,text/plain,author2-2. Two refreshed metadata receipts agree; archived confirmed upload operation preserves exact ID and empty prior-ID baseline. |
| Authenticated file bytes/CORS/download | Pass: two native fileGET200/CORS receipts (app verification and explicit download), exact independent byte hash; actual verified-current-metadata download message. Sanitized receipts omit signed file addresses. |
| Cancel and reviewed queue before Save | Pass via completed runner's exact dialog/task/name/ID/size/permanent warning assertions and zeroDELETE assertions after Cancel and queue. Actual queued-deletion message recorded. No intermediate dialog screenshot exists; this row is assertion/message evidence, not independent rendered-frame inspection. |
| One exact deletion/native absence | Pass: oneDELETE200/CORS for12-3399, native inventory absence required, second confirmed Save message. Final recovery has empty operations/uploads/missingUploads/inventory and two confirmed archived request records, no uncertain delivery. |
| Disconnect/reload/Auto-Sync | Pass: actual disconnect message; final reload asserts noDownload button and Auto-SyncOFF. Final recovery has Auto-Syncfalse and no sharedStatuses enabled. |
| Fixture preservation | Pass within supplied MCP snapshot scope: before/after allthree tasks retain original text,parent,fields,visibility and empty attachments; onlyPMON-467 updatedAt changes. Main Agent chrome-preservation.json records exact comparison. No production task was in the guard allowlist; this is not a repository-wide/server-wide audit. |

Actual uploaded.png reviewed: PMON-467 selected with quarantine parent, legible63-byte file ID12-3399, actual verified-download status, confirmed Save message and Auto-SyncOFF. Actual deleted-reloaded.png reviewed: retained quarantine task/hierarchy, Save light green and Auto-SyncOFF. Its attachment region is below the visible frame, so final absence is established by completed UI assertion, recovery inventory and native/MCP readback, not that screenshot alone. No rendered defect observed in these two frames.

Evidence: artifacts/native-attachments-2026-10-25/chrome-20261025-a/result.json, uploaded.png, deleted-reloaded.png, before-delivery-recovery.json, final-recovery.json, original diagnostic file, staged-export.txt and native-download.txt; parent pmon-mcp-before.json,pmon-mcp-after-chrome.json,chrome-preservation.json. Result's text still says MCP preservation pending because it was emitted before Main Agent's later readback; reviewed preservation evidence now closes that bounded requirement.

Native lost-response/conflict/storage-limit/error branches were not induced; they retain synthetic coverage and remain unrun natively. Actual Firefox, physical OS installation, native status concurrency and desktop cutover remain pending. No retry or repair was needed. Model remains Sol/medium based on prior correct bounded assignments; exact token usage/cost savings unavailable.

---

# Owner amendment: native PMON test fixtures

The owner subsequently authorized synthetic disposable tasks in PMON under a quarantined Test-only Epic. Main Agent created and verified private Epic PMON-466 and children PMON-467 (Chrome) and PMON-468 (Firefox). Native attachment acceptance now targets those children using real PMON identities and unchanged server responses. Existing production tasks remain outside the mutation allowlist. The old NPCD-path blocker below describes the earlier preparation only; no NPCD alias test ran. See NATIVE-ATTACHMENT-PLAN-2026-10-25.md for the active plan. Current native execution remains unrun until the guard review is complete.

# Native attachment acceptance preparation — October 25, 2026

Status: preparation complete; native attachment acceptance is blocked/unrun. No browser, test, credential, source or cloud action ran in this auxiliary assignment. Deployed candidate: `36e748eaad7e360974c62c392a61c639ae19f804` at https://romdex-web.vercel.app. Documentation HEAD inspected: `b8accbaa312813ea712f6ae2a7db455e1d00717f`.

Test-QA Agent: GPT-6.1 Sol / medium, reused on evidence of two preceding bounded local/hosted assignments completing correctly without retries. Usage/comparative savings unavailable. Scope was requirements/adapter inventory, not diagnosis, implementation or harness design.

## Immediate blocker

The current app cannot exercise allowed native NPCD-872/873 attachments through its accepted UI. Its task reader/normalizer, delivery task lookup, attachment request ID validator, delivery preflight and cached-inventory/deletion validation explicitly accept only PMON IDs. These are observed source contracts, not a failed native reproduction. Do not bypass them, substitute live PMON, rename NPCD identities, import crafted workspace data, or claim synthetic PMON coverage proves NPCD support.

| Boundary | Concrete evidence |
| --- | --- |
| Read/import | src/youtrack/read-tasks.ts queries `project: PMON` and normalize rejects a non-PMON project/ID with `YouTrack returned an unexpected task. The browser workspace was not changed.` |
| Delivery task identity | src/youtrack/delivery-client.ts get rejects non-PMON with `Only PMON tasks can be delivered.`; src/youtrack/delivery-read.ts is likewise PMON-query/normalize based |
| Every attachment list/upload/download/delete request | src/youtrack/attachment-client.ts calls issueId from src/youtrack/request.ts, which rejects non-PMON with `Only PMON tasks can be delivered.` |
| Delivery preflight | src/cloud/attachment-delivery.ts rejects non-PMON with `Reconnect file delivery after the task has a verified PMON ID.` |
| Delete queue/cache/recovery contract | src/attachments/actions.ts rejects non-PMON deletion (`Only a delivered task has cloud attachments.`) and cached inventory (`Invalid cached attachment inventory.`); src/attachments/validate.ts rejects non-PMON attachment-delete operations (`Invalid queued attachment deletion.`) |

Main Agent must resolve the acceptance-path prerequisite before native execution can start. This report proposes no code change or alternate harness.

## Established evidence versus pending native proof

Current deployed-source hosted suite passed34/34, including8 attachment cases per Chromium/Firefox. The earlier full browser matrix is historical; current icon-only local15 checks are layout coverage. docs/evidence/chevron-removal-2026-10-25/QA-REPORT.md has exact provenance. The synthetic attachment suite intercepts YouTrack API/file routes with in-memory PMON-900xxx tasks, exact fixture.txt bytes, fake attachment ID134-1 and fixture-owner. Its simulated upload/delete/restart/conflict outcomes do not establish any real server behavior.

| Existing synthetic rendered checks establish | Native acceptance still required |
| --- | --- |
| Durable local stage/reload/export and legacy Blob reads; exact fixture bytes | Actual Windows Chrome/Firefox storage, upload multipart/server receipt and authenticated download on allowlisted NPCD fixtures |
| Cancel/reviewed queue/delete; changed metadata refusal | Real metadata fields/permissions, successful exact new-file deletion, preservation of all preexisting attachments/receipts |
| Lost upload/delete response blocks; reload/readback never resends | Native uncertain outcome/readback evidence if such a condition occurs; no deliberate live failure injection is authorized by this preparation |
| New-task returned-ID remapping | Native new-task creation is outside the two existing fixture allowlist; remains synthetic-only/pending separate scope |
| Recovery transfers exact staged bytes into disconnected workspace | Real browser recovery preservation/restart with diagnostic data, without importing desktop/PMON preview or replaying unrelated queues |
| Oversize/storage-failure/conflict UI messages | Current tenant limit/actual native error behavior; do not manufacture backend errors or change tenant settings |

Real exact-origin preflights and browser-readable invalid-token401 are established. Main Agent independently observed Chrome's authenticated396-task PMON read, preview unimported/delivery disabled. That proves neither Firefox authenticated reading nor authenticated NPCD attachment list/file endpoints, upload/delete or server metadata/hash confirmation. No prior native fixture receipt inventory was inspected here; obtain it before any mutation.

## Ordered native checklist — all pending unless explicitly stated

- [ ] Resolve the PMON-only path blocker under Main Agent ownership; identify a reviewed candidate and refresh exact deployed source/inventory before executing. Current status: BLOCKED.
- [ ] Establish a separate acceptance browser/workspace containing only allowlisted NPCD-872/873 and no imported PMON/desktop data or unrelated queue. Preserve the existing native Chrome396-task preview. Record browser/version/origin, fixture issue identities, original field/attachment inventories and evidence receipts without secrets.
- [ ] Verify existing fixture/receipt preservation and an unambiguous newly created diagnostic filename/content/size/SHA-256 for later deletion. Keep original diagnostic bytes and recovery copies. Do not remove any attachment that predated this run.
- [ ] Use authorized session access without printing/storing secrets in evidence. Confirm bound account, Auto-Sync OFF, production sharing OFF, no pending status/rollup/task edits or uncertain requests. Save Changes processes the whole queue via src/cloud/delivery.ts, so it is not an attachment-only button.
- [ ] In native Chrome, then Firefox sequentially, verify authenticated fixture read/list and actual hosted-origin API/file CORS. Read-only listing must not send a file mutation. Stop at the first meaningful failure and preserve its UI/evidence.
- [ ] Stage one small diagnostic file while delivery is disconnected; observe exact staging message, reload, export staged bytes and compare size/hash. Stage alone must not upload.
- [ ] Enable reviewed session delivery only after isolated queue/account checks; one Save uploads the single staged file. Record operation ID, prior attachment IDs, exact new attachment receipt ID, task ID, account author ID, filename/size and returned metadata; confirm no unrelated write.
- [ ] Download through actual app; verify same metadata and advertised length, then independently compare downloaded SHA-256 with original. Confirm native list shows the new exact ID once. Do not infer correctness merely from a success toast.
- [ ] Open Remove only for this run's new exact ID; check task/name/ID/size and permanent-deletion warning. Cancel must send no DELETE. Queue confirmation must still send no DELETE before explicit Save.
- [ ] After reviewed Save, record successful native deletion and readback absence of this exact ID; preserve all prior files/receipts and verify no unintended issue changes. Recovery cannot recreate a deleted attachment ID.
- [ ] If an actual interruption/uncertainty occurs, stop delivery; preserve recovery/journal, reload and verify no resend. Review exact IDs/bytes or explicit deletion/access acknowledgement; never automatically replay. Deliberately inducing a native failure needs its own bounded plan, not inferred authorization here.
- [ ] Disconnect session; verify Auto-Sync/sharing remain OFF and diagnostic queues/receipts have recorded disposition. Preserve evidence, original desktop, PMON and preexisting fixture state. Do not delete evidence or clean existing fixtures.

## Exact UI messages and receipt criteria

- Stage: `File staged in this browser. Save Changes sends it when delivery is connected.` Export: `Staged bytes exported. No cloud request was made.` Restore: `Queued file bytes restored and verified. Delivery review requirements are unchanged.`
- List: `<count> attachments read. No file mutation was sent.` Download: `Attachment downloaded from verified current metadata.`
- Setup: `Saved. Use Save Changes to run one delivery cycle.` Normal Save: `Queued supported changes confirmed by YouTrack. Auto-Sync preference unchanged.` Disconnect: `Disconnected. Queue and drafts kept; session token discarded.`
- Deletion dialog: `Queue deletion of this attachment?`; confirm button `Queue Attachment Deletion`; queued status `Attachment deletion queued. Connected Save Changes sends the reviewed request.` Changed metadata selects `Review the changed attachment. No deletion was sent.`
- Uncertainty: `The delivery result is uncertain. Your queued change is preserved for review.` Heading `Uncertain delivery`; `Read Current Attachment IDs` yields `Current attachment IDs read. No upload or deletion was resent.` Exact-ID field and `Read back and confirm; do not resend` are the review path. Delete confirm is disabled until `I checked <ID> in YouTrack. Missing can mean lost access; confirming will never resend its deletion.` is checked.
- Oversize: `YouTrack accepts files up to 10 MiB. No upload was sent. Keep the original file.` Staged-storage refusal: `Staged file could not be saved. Keep the original file.`

Upload confirmation in src/cloud/attachment-delivery.ts requires one returned exact new ID absent from baseline, same name/size, author equal to connected account and SHA-256 of actual downloaded bytes equal to queued hash. src/youtrack/attachment-client.ts refreshes metadata and requires exact id/name/size/MIME/created/updated/author equality before downloading. Byte transport accepts only same-tenant api/files endpoints, omits cookies, refuses redirects, bypasses caches and requires exact advertised length (50MiB download ceiling). Upload ceiling is10MiB, legacy recoverable file ceiling50MiB, staged workspace ceiling64MiB. These are code-reviewed criteria; native compliance remains unrun.

Documentation note: ATTACHMENTS.md still says real hosted-origin CORS is pending. Later exact-origin preflight/401/Chrome-read evidence narrows that statement; authenticated native file-endpoint/attachment acceptance remains pending. No missing server guarantee is inferred from fixtures.




