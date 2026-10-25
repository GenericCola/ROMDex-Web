# Chevron removal QA — October 25, 2026

PASS: local affected suite15/15 and hosted suite34/34. Each suite ran once, with exit0 and no failures/skips/retries/repairs. This is current bounded acceptance for the icon correction; earlier full303-case results remain historical and were not rerun.

Candidate:36e748eaad7e360974c62c392a61c639ae19f804, branch codex/accepted-app-port. Local origin http://127.0.0.1:3100; hosted origin https://romdex-web.vercel.app. Main Agent reported check/build exit0 before local QA and GitHub MCP Vercel success for exact candidate/deployment2wVQGaXW2mCoTFXMCvd7cA272wMK before hosted QA. Deployment receipt is deployment.json. QA did not build/deploy/query that gate independently.

Owner correction: remove the rejected double-chevron from red workspace control. Complete correction and three-file diff read: icon import/render and unused SVG CSS removed; symbol assertion removed from existing interaction test. Accessible red control,34px hit area and menu behavior preserved. No backend/storage/status change in scope.

Test-QA Agent: GPT-6.1 Sol /medium reused because preceding hosted34 assignment completed correctly without retries. No comparative token measurement or invented savings. Browser runs use Windows, one worker and isolated Playwright contexts; synthetic API fixtures are intercepted in memory. No implementation, source edit, build, install, commit/deploy, desktop/profile/credential read or native YouTrack write by QA.

## Acceptance checklist

- [x] Exact candidate and successful check/build supplied by Main Agent before local run.
- [x] Single local affected15 invocation, all five existing profiles:15passed,0failed/skipped, exit0,35.2seconds. Exact log/result retained.
- [x] Actual local Chromium1280 details and Firefox320 menu screenshots show blank red control face with no chevron.
- [x] Layout/save spacing/header34px hit targets, pointer/keyboard switching/dismissal/focus preserved at1280/800/390/320.
- [x] Centered dialog, sticky X, restored keyboard focus and rendered synthetic503 error pass all five local profiles.
- [x] Exact-source Vercel success supplied before hosted invocation.
- [x] Single hosted34 invocation, Chromium/Firefox:34passed,0failed/skipped, exit0,53.9seconds. Exact log/result retained.
- [x] Actual hosted screenshots show blank red control at normal/narrow widths, with usable menu and focus.
- [x] Hosted worker template,74assets and configured headers verified. Actual hosted inventory ab1f7919250cf0cbbfa8 differs from local753850fbfff5595104e9 as expected for separate build IDs; no byte identity between builds claimed.
- [x] Existing synthetic attachment/recovery/offline/install-message and actual invalid-token401 UI/CORS checks pass.
- [x] Candidate HEAD/branch unchanged before/after each phase; app source unchanged. Main Agent documentation changes explicitly excluded.
- [ ] Private evidence ZIP/backup verification — pending Main Agent, outside Test-QA ownership.

## All local case dispositions

Each cell records one executed case;15total.

| Case | Chromium | Firefox | WebKit | Mobile Chromium | iPhone |
| --- | --- | --- | --- | --- | --- |
| Task columns, narrow scrolling, notes/save light, reachable content/header hit areas | Pass | Pass | Pass | Pass | Pass |
| Workspace menu keyboard/pointer/switch/dismissal/focus at four widths | Pass | Pass | Pass | Pass | Pass |
| Centered dialog, close reachability, actual rendered synthetic503 and focus | Pass | Pass | Pass | Pass | Pass |

Command: `pnpm test:e2e tests/e2e/ui-layout.spec.ts --reporter=line --output=artifacts/chevron-removal-2026-10-25/local-results`. Existing preview serves out on3100; QA did not rebuild.

## All hosted case dispositions

Each row records two executed cases;34total.

| Case | Chromium | Firefox |
| --- | --- | --- |
| Offline attachment stage/reload/exact bytes/reviewed deletion | Pass | Pass |
| Lost upload exact receipt/readback after restart, no resend | Pass | Pass |
| File follows returned synthetic new-task identity | Pass | Pass |
| Oversize actual limit/refusal message, no queue/upload | Pass | Pass |
| Lost deletion exact acknowledgement, no second DELETE | Pass | Pass |
| Metadata conflict message, no DELETE | Pass | Pass |
| Recovery exact bytes/import separate workspace, delivery disconnected | Pass | Pass |
| Failed staged storage refusal, no upload | Pass | Pass |
| Actual app controls show browser install instructions | Pass | Pass |
| Simulated standalone status message | Pass | Pass |
| Properties/notes/layout/save light/hit targets at four widths | Pass | Pass |
| Workspace menu keyboard/pointer/switch/dismissal/focus | Pass | Pass |
| Centered normal/narrow dialog, sticky X, synthetic503/focus | Pass | Pass |
| Real invalid-token401 visible through actual UI/CORS | Pass | Pass |
| Worker/template/all74assets/headers/manifest/404 | Pass | Pass |
| Fresh shell zero automatic YouTrack requests/desktop imports | Pass | Pass |
| Browser-local offline note reopening | Pass | Pass |

Command: `ROMDEX_HOSTED_ORIGIN=https://romdex-web.vercel.app pnpm test:e2e --config=playwright.hosted.config.ts --reporter=line --output=artifacts/chevron-removal-2026-10-25/hosted-results` (PowerShell environment assignment). Both real CORS receipts show HTTP401 and exact visible message `YouTrack read failed (HTTP 401). Check token access to PMON.`, validCredentialUsed=false,cloudMutation=false. No authenticated acceptance inferred.

## Rendered evidence and preservation

Viewed newly generated local and hosted Chromium details1280 and Firefox menu320 via view_image. The control is a blank red circle at normal/narrow widths; no chevron is visible. Normal task properties and notes remain separate legible columns. Narrow header controls wrap within viewport, menu is contained and focused NPCDex has a visible ring. The open menu intentionally overlays recovery controls until dismissed; dismissal tests pass. These are developer automation/rendered observations, not owner-observed acceptance. Main Agent independently confirmed the blank face in its empty hosted browser preview.

Previous relevant screenshots copied without deletion/move to artifacts/chevron-removal-2026-10-25/before. Local screenshots preserved in local; current hosted screenshots, inventories and CORS receipts preserved in hosted. Suite-defined original outputs under artifacts/ui-repair and artifacts/task-first-migration were generated as designed; source/build/out not changed. Result files/logs and before/after candidate identities are in this report directory. evidence-manifest.json hashes all unique evidence files (excluding itself).

Final HEAD remains36e748eaad7e360974c62c392a61c639ae19f804. Final tracked diff contains only Main Agent docs/MIGRATION-RESUME-2026-10-25.md,docs/TASK-FIRST-MIGRATION.md,docs/UI-REPAIR-2026-10-24.md. Other Main Agent untracked support files were preserved. No first meaningful failure occurred, so no diagnostic or repair loop was needed.

Main Agent's independent authenticated396-task read was not accessed/repeated; native Chrome preview and desktop remain outside this QA. Native authenticated attachment writes, concurrency safety, physical Windows installation, desktop backup/export/import and owner acceptance remain separate gates. Private backup awaits Main Agent after final QA writes.
