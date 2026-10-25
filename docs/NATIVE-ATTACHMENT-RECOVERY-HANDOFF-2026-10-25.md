# NA-001 recovery discriminator handoff - 2026-10-25

Test-only recovery mode is ready for Main Agent review. No browser, credential or live request ran during this assignment. This is a bounded discriminator for the interrupted Firefox operation, not a production repair or a conclusion about why the prior confirmation stalled.

Read the complete Main Agent recovery plan, actual firefox-20261025-b/result.json and stopped-recovery.json, active PMON authorization and connected UI/readback implementation. Evidence shows exact receipt 12-3400 retained for PMON-468, account 2-2, operation fb03c726-31c5-41c2-8018-3749640baf6d. Native upload/file GET passed in the original run, while the expected Save message was not observed. The 5-second assertion limit is a hypothesis; this assignment does not mark original completion passed.

## Frozen source and preserved input

| File | SHA-256 |
| --- | --- |
| scripts/native-attachment-acceptance.mjs | 1a62f497df4c12495fa4ae5d31d129894e67f8ef1c3f2b7efd0790d38f1bab69 |
| scripts/native-attachment-guard.mjs | 32d8e8f6be80b901ad033e8d7f32cf713c48d25061959208076dfd4ceaee2306 |
| scripts/native-attachment-guard.test.mjs | 4771210e6e7c2063cff0082bac8ec02ff1fb7c293b1783b4925e3ad413bc79b3 |
| artifacts/native-attachments-2026-10-25/firefox-20261025-b/stopped-recovery.json | 79ef8657d53d40be96fe8e213711c6fe99c6f35cddf8ca7d74891df6a66f7099 |

Pre-NA-001 scripts and original build handoff were copied unchanged to artifacts/native-attachments-2026-10-25/pre-na001-harness. Their hashes match the prior frozen candidate. Original Firefox result, screenshot and recovery remain unchanged; recovery SHA was checked after offline work. Main owns the saved-token wrapper, which this assignment did not read or edit.

Expected app source remains 36e748eaad7e360974c62c392a61c639ae19f804; expected hosted worker ab1f7919250cf0cbbfa8 is supplied by Main's plan, not independently measured here. No app source/build/deploy/default-suite changes.

## Scope and checklist

| Requirement | Harness behavior / disposition |
| --- | --- |
| Exact input and isolated queue | Recovery mode accepts only the original path and pinned SHA. Validates one exact pending upload, operation/task/receipt/account/file metadata, 64 bytes and SHA-256, only three quarantine tasks with exact titles/parents, no other journal operations/uploads/drafts, Auto-Sync OFF and sharing/rollup absent. Offline verification passed. |
| Actual recovery import | Fresh Firefox, actual Import Desktop or Recovery Data controls, verified-file message, preserved-copy checkbox and import. Requires disconnected delivery and Auto-Sync OFF; captures uncertain heading. Runtime pending. |
| Same account | Native users/me must return 2-2. No mocked response or credential. Runtime pending. |
| Zero upload permissions | Recovery policy rejects every POST before network continuation, even a resend requested by the app. Existing query/identity/GET/CORS guards retained. Offline refusal passed. |
| Exact readback | Actual Read Current Attachment IDs and exact receipt field, then Read back and confirm; do not resend. Requires uncertain heading gone, exported queue empty, exact journal confirmed status/receipt/message and zero POST/DELETE. Runtime pending. |
| Exact bytes before deletion | Native metadata must retain original receipt/name/size/MIME/author/created/updated. App readback checks byte hash. Explicit download independently compares exact bytes; at least two successful native file/CORS receipts required. Only after this does runner enable byte-verified deletion eligibility. Runtime pending. |
| Cancel/reviewed delete | Actual dialog, exact task/file/ID/size/permanence checks; Cancel and queue keep DELETE count zero. Guard arms only 12-3400 after metadata/byte verification and UI queue. One explicit Save permits at most one DELETE, then requires native empty inventory and exact Save success message. Runtime pending. |
| Recovery persistence | Disconnect, reload, no file, Auto-Sync OFF and exported empty operation queue. Original input SHA recorded again even on stop. Runtime pending. |
| Timings | Recovery uses configured Playwright expect timeout 30 seconds and page timeout 30 seconds. Named phase start elapsedMs plus total elapsedMs are recorded without values/URLs/credentials. |
| Failure | Stop with sanitized phase/results; no resend, automatic cleanup or retry. Preserve screenshot and recovery when possible. If readback does not narrow the issue, return evidence to Main. |

The ordinary upload mode remains available for its original scope, but it is not authorized for NA-001. The explicit --recovery argument selects the zero-POST policy. Main must invoke the exact recovery command below. No other attachment ID or second upload is permitted in this discriminator.

## Invocation for Main Agent after review

From C:\Users\mrgen\ROMDex, set the nonsecret browser-cache location and let Main's wrapper feed the opaque token to stdin, then close stdin. Never put the token in arguments, an environment variable, a persisted file or a transcript. Output directory must be new; its parent already exists. The runner verifies the absolute browser-cache setting matches the repository path.

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = 'C:\Users\mrgen\ROMDex\.playwright-browsers'
node scripts/native-attachment-acceptance.mjs --browser firefox --fixture PMON-468 --run firefox-recovery-20261025-a --output artifacts/native-attachments-2026-10-25/firefox-recovery-20261025-a --recovery artifacts/native-attachments-2026-10-25/firefox-20261025-b/stopped-recovery.json
```

No browser-cache/profile reads or launch happened here. Main executes this only after frozen review and appropriate independent MCP before-state checks. Preserve existing Chrome preview, desktop data, NPCD receipts and all other project work. Production sharing remains OFF.

## Offline evidence and limits

Final Node guard run: 57 cases passed, including prior 44 cases and 13 recovery cases. Added cases cover pinned recovery validation/byte alteration, wrong fixture/account/receipt, every POST route, deletion before review, unrelated deletion, changed metadata and exact readback/one-time deletion. Syntax check passed. Offline tests use only local preserved diagnostic data and pure guards; they do not establish actual UI, browser CORS, native readback or deletion.

A harmless PowerShell typo emitted a command-not-found message during editing; the intended file write still completed. Subsequent syntax and offline checks passed. No live retry occurred. Repair Agent reused Astra/low as selected by Main; no model change or precise token savings claimed. Actual usage unavailable. Only test harness, offline tests, this handoff, a pointer in the previous build handoff and preserved candidate copies changed.
