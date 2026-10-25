# Hosted UI QA — October 25, 2026

Result: the single hosted invocation passed all 34 cases (17 Chromium + 17 Firefox), zero failed/skipped, exit code 0, elapsed 53.9 seconds. No retry or repair was performed.

Candidate: `3e8c0dbf1092ff68867b91216d49494b302b1ea3`, branch `codex/accepted-app-port`. Origin: https://romdex-web.vercel.app. Main Agent confirmed exact-source Vercel success before execution: https://vercel.com/pmon1/romdex-web/A7JuTCHSk2rY2mKkCbLkLqCSVWsM. That confirmation is supplied by Main Agent, not independently queried by Test-QA Agent.

Test-QA Agent: GPT-6.1 Sol / medium, conservative choice for an existing bounded suite and rendered review. No comparable measurement for this exact assignment; no token savings invented. Existing local check/build/303-pass evidence was reused as historical evidence, not rerun.

Command: `ROMDEX_HOSTED_ORIGIN=https://romdex-web.vercel.app pnpm test:e2e --config=playwright.hosted.config.ts --reporter=line --output=artifacts/ui-hosted-2026-10-25/results` (PowerShell environment assignment). One worker, Chromium and Firefox Playwright Desktop profiles, fresh isolated browser contexts, Windows host. Exact runner result and log: `run-result.json`, `hosted-suite.log`.

## Complete case dispositions

Each row has two independently executed passing cases; together these record all 34 configured cases.

| Case / required behavior | Chromium | Firefox |
| --- | --- | --- |
| Attachment staging offline, reload durability, exact byte download, reviewed deletion | Pass | Pass |
| Lost upload exact receipt and readback after restart, no resend | Pass | Pass |
| New-task file follows exact returned synthetic task identity | Pass | Pass |
| Oversize selection actual tenant-limit message, no queue/upload | Pass | Pass |
| Lost deletion blocked until exact acknowledgement, no second DELETE | Pass | Pass |
| Changed deletion metadata conflict message, no DELETE | Pass | Pass |
| Recovery exports/imports exact staged bytes, separate context, delivery disconnected | Pass | Pass |
| Failed staged storage refusal message, no upload | Pass | Pass |
| Actual app control shows Chrome/Firefox install instructions | Pass | Pass |
| Simulated standalone launch shows installed-app status | Pass | Pass |
| Task properties/notes usable at 1280/800/390/320, green/red save light and >=8px spacing, reachable content, header hit areas/no overflow | Pass | Pass |
| Workspace symbol/menu at four widths, Arrow/Home/End/Escape/Tab, outside click, switching and focus | Pass | Pass |
| Centered normal/narrow dialog, rendered synthetic HTTP 503, sticky X and restored keyboard focus | Pass | Pass |
| Real deliberately invalid-token HTTP 401 via actual app and CORS; visible exact error | Pass | Pass |
| Actual worker template, every asset hash, configured headers, manifest and missing route | Pass | Pass |
| Fresh hosted app renders with zero automatic YouTrack requests or desktop import | Pass | Pass |
| Browser-local note persists through offline reopening | Pass | Pass |

## Hosted and rendered evidence

Actual hosted worker version is `b539cd50619d899150bd`; inventory is checked by hashing the frozen source service-worker template and each hosted asset, then comparing the reconstructed worker text. The separate local-build inventory is historical and is not asserted to match the hosted build. Inventories and shell screenshots are copied under `artifacts/ui-hosted-2026-10-25/after/task-first-migration`.

The actual Chrome and Firefox CORS receipts both record HTTP 401 and visible text `YouTrack read failed (HTTP 401). Check token access to PMON.`, validCredentialUsed=false, cloudMutation=false. These prove an unauthenticated browser-readable refusal, not authenticated acceptance.

Actual newly generated screenshots inspected with view_image:

- `after/ui-repair/chromium-details-1280.png`: selected Fixture Root displays properties in its left column and a substantially wider notes editor to the right; title/select controls and note text are legible, separate and not overlapping. Save label has a visibly separate red indicator. Content below the fold is covered by the automated scroll/reachability checks, not claimed visible in this frame.
- `after/ui-repair/firefox-connection-error-390.png`: dialog fits narrow viewport with margins; heading/X stay visible at the top while HTTP 503 error text is readable at the bottom, with token/read controls between them and no overlap.
- `after/ui-repair/chromium-menu-320.png`: menu stays inside the viewport, both workspace choices are legible and the keyboard focus ring is visible on NPCDex. Header controls wrap within the width. The open menu overlays the recovery toolbar as expected; automated dismissal checks verify it disappears.

The 503 is an intercepted unavailable-service fixture exercised through the actual UI. It is not a real backend outage. The 401 is a real unauthenticated backend response.

## Preservation and limits

HEAD and branch match before/after. Only tracked change is Main Agent's existing `AGENTS.md`; its untracked migration-resume document also remains. No Test-QA source change, build/out mutation, deployment, commit, native YouTrack write, PMON mutation, .env/token/cookie read, or desktop/profile access occurred. Fresh automated browser storage and downloads are diagnostic data. Suite-defined synthetic API requests were intercepted in memory; PMON-looking fixture identities do not represent live task mutations. Existing generated files overwritten by the suite were copied first: 24 relevant previous files in `artifacts/ui-hosted-2026-10-25/before`; no deletion/move was performed.

Authorized QA writes: this report/source receipts/log/result/manifest, unique artifacts/results and before/after copies, plus existing suite-defined generated screenshots/inventories under `artifacts/ui-repair` and `artifacts/task-first-migration`. Full file hashes are in evidence-manifest.json.

All bounded hosted UI acceptance items passed. Private evidence backup remains Main Agent's pending acceptance check. Native authenticated reads/attachments, safe shared-status concurrency, physical Windows installation, desktop backup/export/import and owner-observed layout acceptance are outside this suite and remain pending. No new issue arose; no failure was suppressed or retried.
