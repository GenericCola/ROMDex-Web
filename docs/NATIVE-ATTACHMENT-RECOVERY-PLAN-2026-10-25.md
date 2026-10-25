# Firefox attachment interruption: NA-001

## Main Agent analysis and next discriminator

Chrome completed one native upload/download/reviewed deletion with exact bytes and MCP preservation. Firefox attempt a stopped before launch because the wrapper omitted the repository browser-cache setting. The one-line configuration repair and credential-free Firefox157 launch passed. Attempt b then read the real quarantine, staged/exported64bytes, connected account2-2 and read an empty attachment list. Native POST returned12-3400, metadata matched, one native file GET returned200/CORS and the final task GET returned200. The expected Save completion message was not observed. The screenshot still shows Delivering supported queued changes. Recovery retains operationfb03c726-31c5-41c2-8018-3749640baf6d, exact receipt12-3400 and fileSHA25696b32b2ba21f7d946c18a2ad76262ab63bb2b45e8aaa78961f033835bd10f8b6. MCP confirms that single file remains on PMON-468; other fields/parent/visibility are unchanged. No DELETE or repeated POST occurred.

Likely boundary: the standalone runner uses Playwright expect's5-second default while actual native confirmation includes multiple network and storage awaits. Its page default timeout does not change expect timeout. This is a code-supported hypothesis, not proof of an app defect or completed confirmation. Export normalizes interrupted attempts to uncertain; it does not prove the live app independently failed before the harness stopped it.

Smallest useful next check: a fresh isolated Firefox context imports the preserved recovery via the actual UI, reconnects the same account, and explicitly reads/confirms exact attachment12-3400 without any POST permission. Use a30-second assertion timeout and sanitized per-phase timings. If readback succeeds, verify exact downloaded bytes and the confirmed journal, then exercise Cancel/reviewed queue/Save deletion of that same file once and independently verify absence with MCP. This resolves the preserved operation before another new-upload test. Do not repeat upload or bypass the nonempty baseline. If this bounded readback does not narrow the failure, stop and return evidence for Main/user direction; no retry loop.

## Required boundaries

Read active PMON plan and owner correction: only private test EpicPMON-466 and children467/468 authorized; existing production tasks, desktop/profile, nativeChrome396preview, NPCD and sharing stay intact. Exact deployed source36e748eaad7e360974c62c392a61c639ae19f804, hostedworkerab1f7919250cf0cbbfa8. Original result/screenshot/recovery under artifacts/native-attachments-2026-10-25/firefox-20261025-b stay unchanged.

- Test-only recovery harness; no app source/build/deploy/default-suite changes.
- Input recovery is exactly the preserved stopped file; validate its operation ID, taskID, receiptID, author binding, filename,size,bytehash and SHA identity. No other pending operation or upload allowed. Record its exact SHA before/after.
- Fresh Firefox context using repository .playwright-browsers. Actual browser network/CORS and native responses unchanged; same approved task list query restriction and fixture identity guards.
- Credential stdin only, no traces/HAR/video/debug logs. Never read credentials as a subagent. Main supplies through existing wrapper after review.
- Every POST denied at network guard, including attempts to resend upload. All task/status/comment/link/app writes denied. GET only approved fixture/account/attachment/file addresses. At most one DELETE, only12-3400 after actual UI review and exact-current metadata/hash validation.
- Import through actual recovery controls; verify disconnected and Auto-Sync OFF. Capture visible uncertain review, Read Current Attachment IDs, exact-ID confirmation and absence of uncertain heading/cleared upload queue. Confirmation must issue zero POST/DELETE.
- Verify explicit download SHA matches original and successful native CORS. Cancel deletion zeroDELETE; queue zeroDELETE; explicitSave oneDELETE thenempty nativeinventory, exactsuccessmessage, disconnect/reload nofile/queue, preserve finalrecovery.
- On any failure, stop, retain evidence, no automaticcleanup/retry. Never mark pending/nativeerrorbranches passed.
- Run focused offline guard refusal checks including POST forbidden for recovery, unrelatedID/oldreceipt/delete-before-review, then Mainreview before live invocation.

## Role/model

Repair Agent Astra/low reused for this small test-harness confirmation path after Main analysis. Prior Build-Audit produced44passingguardcases and a Main-reviewed observer correction; no model/costsavings claim. It may implement boundeddiagnostic/recovery tooling only, withno liveexecution/credentialaccess. Test-QA Agent Sol/medium records actualevidence afterward. Mainexecutes sensitivecredentialhandoff and independentMCP preservation.

## NA-001 disposition and next bounded confirmation

Independent Test-QA Agent review passed exact recovery, byte verification, one reviewed deletion and preservation. The original upload-completion observation remains failed/historical. No actual application defect was established. The original test used a five-second assertion limit despite multiple native network/storage operations; recovery with a thirty-second limit succeeded, but this alone does not prove the original cause.

Next discriminator: one new uniquely named synthetic Firefox file on the now-empty PMON-468 fixture, using the same unchanged app and exact one-POST/one-reviewed-DELETE guard. Main changes only the test runner's ordinary assertion/page timeout to thirty seconds, matching the reviewed recovery. The frozen recovery runner is preserved as recovery-runner-1a62f497.mjs. Phase timings remain enabled. Empty native baseline, fixture/account validation and exact bytes/receipts remain mandatory. Stop on any new failure; do not repeat the failed upload or bypass the baseline. No further code change is proposed. This small two-expression harness correction is handled by Main; the established Test-QA Agent reviews completed evidence afterward. No new agent or benchmark is needed.
