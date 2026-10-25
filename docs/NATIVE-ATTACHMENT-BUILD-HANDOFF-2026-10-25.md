NA-001 update: current scripts include a narrowly scoped recovery mode. Use docs/NATIVE-ATTACHMENT-RECOVERY-HANDOFF-2026-10-25.md for current frozen hashes and the authorized zero-POST recovery invocation. This original build candidate is preserved under artifacts/native-attachments-2026-10-25/pre-na001-harness.

# Native PMON attachment runner handoff - 2026-10-25

Ready for Main Agent security review; live execution remains UNRUN. The active runner uses actual private quarantine Epic PMON-466 and children PMON-467/468. It does not alias identities or synthesize responses. Existing production tasks, NPCD receipts, desktop data and the owner's existing Chrome preview are untouched.

The previous unexecuted alias runner, guard, 29-case tests and handoff were copied without changes to artifacts/superseded-native-attachment-alias-2026-10-25 before adaptation. SUPERSEDED.txt records their disposition. Never execute that archived runner.

## Frozen files

| File | SHA-256 |
| --- | --- |
| scripts/native-attachment-acceptance.mjs | 207cc5a85e964fc2e2a18f888a32a1ad2b783ba5672fe152c0008a71dad9cc92 |
| scripts/native-attachment-guard.mjs | c1c6b68a1576c9e173df39fbee9b6b46af53bf0b486a531ec33d1b65327e2c55 |
| scripts/native-attachment-guard.test.mjs | 4cb610913f847658a150aea85d6e68bfff23c9e0524d45e43332c33a15af62a8 |

Expected hosted source: 36e748eaad7e360974c62c392a61c639ae19f804. Main Agent must independently reconfirm deployment identity; the recorded expected hash does not prove what was served. Read complete active amendment, AGENTS authorization, original scoped requirements and MCP baseline artifacts/native-attachments-2026-10-25/pmon-mcp-before.json. Exact summaries include the [ROMDex TEST ONLY] prefix for all three tasks. Children must have only PMON-466 as parent; Epic has no parent.

## Verification and review

Final `node scripts/native-attachment-guard.test.mjs`: 44 offline cases passed. Final `node --check scripts/native-attachment-acceptance.mjs`: passed. No browser launch, credential access, native request, app build, default suite, installation or deployment occurred.

The PMON adaptation initially left one alias reference in an offline test; its first run failed before network/browser activity. This was removed. Review then added a refusal for empty later pages establishing the identity baseline. A PowerShell edit command had a parse failure and made no changes; the corrected edit and final tests passed. No live retries occurred.

Review covers single sequential operator use: exact browser/fixture pairing; query/identity boundaries; complete multipart validation; exact new-file receipt; reviewed one-time deletion; token/logging exclusions and stop behavior. No known bypass found in this bounded review. Main Agent frozen review identified that attachment-bytes.ts passes a URL object to fetch. The observer now normalizes strings and URL objects directly, and Request objects through .url. Acceptance additionally requires at least two successful observed native file/CORS receipts after upload verification and explicit download. This was a pre-execution review finding, not a runtime failure. The corrected runner passes the existing 44 offline guard cases and syntax check. Browser CORS, UI behavior and native upload/deletion are pending runtime proof.

## Acceptance checklist

| Requirement | Implemented boundary / evidence still pending |
| --- | --- |
| Preserve app and existing work | Three standalone scripts only; no app source, package scripts, build/deploy or default-suite changes. Fresh contexts only; no existing profile. |
| Native task reads | Only ordinary task-list query is rewritten to exact verified `project: PMON issue ID: PMON-466, PMON-467, PMON-468 sort by: created asc`. Fields/top/skip preserved. Details only for these three IDs. Observer validates exact count, unique IDs, project, titles and parents before app receives unchanged Response. |
| Actual import/selection | Real stdin token used for read; requires exact 3-task read message, cleared token field, Save 3 Tasks, closed dialog, Expand All and selected actual child title. No workspace fabrication. Pending live proof. |
| Native CORS | All traffic uses browser fetch and route.continue; no route.fetch or route.fulfill. Observer requires Response.type=cors and at least two successful native file receipts before acceptance can pass. Test observer enforces redirect:error and credentials:omit, including initial task reader which does not set redirect:error itself. No native headers/body/response rewritten. |
| Mutation boundary | PMON-467 only for Chromium, PMON-468 only for Firefox. One exact multipart file POST, then one reviewed DELETE of its newly returned ID. All task/status/link/comment/app writes and sibling/Epic attachments denied. NPCD denied. |
| Baseline/receipt | Native task identity proof, account and empty attachment baseline required before upload. Exact filename/bytes/MIME/framing checked. Repeated POST, old/unreviewed/repeated DELETE refused. Native inventory verifies receipt/name/size/author. |
| Download address | Exact same-tenant file URL registered from validated native metadata only. Signed query stays in memory; output substitutes a file-address placeholder. App verifies metadata and SHA-256; runner compares downloaded bytes independently. |
| Staging/recovery | Actual disconnected stage message, reload, byte export and recovery byte comparison before connection. Recovery evidence includes this quarantine workspace only. Pending live proof. |
| Review/delete | Dialog must contain exact child, file, ID, bytes and permanent-deletion text. Cancel sends zero DELETE. Queue sends zero DELETE before Save. Only then is exact ID armed. Native empty readback required after DELETE. Pending live proof. |
| Completion | Actual confirmed Save messages, disconnect message, reload absence and Auto-Sync OFF. Sharing never enabled; extension endpoint traffic denied. Pending live proof. |
| Secrets/errors | stdin only, bounded token; no traces/HAR/video/log forwarding. DEBUG/PWDEBUG/NODE_DEBUG refuse before input. Raw Playwright errors never printed. Token fields cleared before screenshots. No storage dumps. Main owns opaque credential wrapper. |
| Stop | Any guard refusal halts traffic. Sanitized result, cleared-field screenshot and recovery export attempted; no cleanup, resend or retry. Capture failures remain missing evidence. |
| Preservation | Main owns fresh MCP before/after checks for all three tasks, receipts and attachments. Timestamps can legitimately change for file operations. |

Offline cases include wrong origin/fixture/method/query/duplicate fields, direct NPCD, unrelated PMON, unexpected list IDs/project/title/parent/count, requested-detail mismatch, sibling/Epic attachments, missing baseline, nonempty inventory, malformed/changed multipart, repeated upload/deletion, reused/invalid receipt, registered signed URL exactness and foreign returned URL. The allowed native URL remains unchanged except task-list query narrowing.

## Invocations for Main Agent, not executed

From C:\Users\mrgen\ROMDex, use a never-used run and output directory. Parent directory must exist. Supply opaque token privately to stdin and close stdin; never place it in command text, shell history, environment, files or logs. Main's credential wrapper must contain no obsolete NPCD metadata calls.

```powershell
node scripts/native-attachment-acceptance.mjs --browser chromium --fixture PMON-467 --run chrome-20261025-a --output docs/evidence/native-attachments-chrome-2026-10-25-a
```

After result and MCP preservation review, separately:

```powershell
node scripts/native-attachment-acceptance.mjs --browser firefox --fixture PMON-468 --run firefox-20261025-a --output docs/evidence/native-attachments-firefox-2026-10-25-a
```

Chromium uses channel chrome in a fresh headless context, never the user's existing profile. Missing installed Chrome stops execution. Firefox uses the installed Playwright engine and records exact version; it does not establish physical Firefox OS installation. Service workers are blocked in both fresh contexts.

Retain stopped files/receipts for explicit review. Never rerun to bypass a nonempty baseline. Native preflight interception or omitted multipart bytes causes refusal, not a workaround. Native CORS and complete UI flow remain unrun. The runner's PASS is attachment acceptance only, with MCP preservation still pending; SC-001 still blocks production sharing and cutover.

Build-Audit Agent reused Astra/low under Main Agent selection; no model change claimed. Token/cost comparison unavailable. Changes: three diagnostic scripts, this updated handoff and immutable superseded copies. Text hygiene Python utility was unavailable earlier; final prose was reviewed manually. No broad app rebuild or test matrix was warranted for nonshipping harness files.


