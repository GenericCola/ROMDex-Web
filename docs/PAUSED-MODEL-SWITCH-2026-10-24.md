# Paused for model switch — October 24, 2026

The owner requested pausing migration at a convenient point. The running browser
matrix finished successfully. Finish checkpoint verification only, then stop.
Resume migration/development only after the owner asks to resume.

## Exact worktree and checkpoint

- Worktree:`C:\Users\mrgen\ROMDex`.
- Branch:`codex/accepted-app-port`.
- Private backup: annotated tag`romdex-web-ui-pause-2026-10-24` in
`GenericCola/ROMDex-Web`. Resolve its peeled commit with`git ls-remote`.
- The tag includes the earlier unpushed documentation/evidence commit
`91632c3aa34c6888139837c4039936314d10bcd5` and this UI repair checkpoint.
- Only the tag is pushed for this pause. The remote deployment branch remains
`76fa8990e7d0cdac2d273e452dc7d5b66da98b50`. The local branch is ahead.
- No branch closure, artifact cleanup, deletion or pruning. All current and
  concurrent work remains preserved.

## Completed UI work

The task pane had four children in a two-column grid, compressing properties
into a tiny implicit row and putting notes in the narrow column. Properties now
have their own column; notes, images and attachments share the wider scrolling
content column. Narrow windows retain a single scrolling details pane.

The save lamp now receives its missing spacing/animation class. The workspace
switch keeps the red face, adds a switching symbol and a usable hit area, and
supports pointer/keyboard dismissal and arrow/Home/End navigation. Native
dialogs are centered, their heading/X remain visible during scrolling, and
closing restores keyboard focus. RDX retains its existing top anchor. Palette,
status meanings, filter matching/active color and inert delivery locks remain.

Read`UI-REPAIR-2026-10-24.md` for the requirement checklist and review.

## Final local verification

-`pnpm check`: types/lint pass, 135 application tests plus 30 contracts pass.
-`pnpm build`: passes; local worker`cd889c193fea39af5e53`, 74 cached assets.
-`pnpm test:e2e --reporter=line`: one final complete invocation, 303 passed,
  two expected platform skips, zero failures, 10.8 minutes. All 15 new rendered
  layout checks pass across all five browser profiles.
- Earlier failures/interrupted runs are history, not passing evidence. A real
  320px menu overflow and dialog-unmount focus loss were fixed. Safari's
  pointer-does-not-focus behavior required a keyboard-specific focus test and
  avoiding blur-based menu dismissal.
- Raw evidence ZIP has 72 independently decompressed/hash-verified members:
`evidence/ui-repair-2026-10-24/LOCAL-UI-EVIDENCE.zip`, SHA-256
`0870dbc043bcc4d94a6e567e7b4f6a50a7594cca17123b2269b442fb50a7d3cf`.
- The UI repair has NOT been deployed or hosted-tested.`playwright.hosted.config.ts`
  now includes its six Chrome/Firefox cases, plus two prepared real CORS tests.
  Run only one browser suite at a time; the main suite uses port 3100 and clears
  test-results. Avoid overlapping suites or changing`out` while tests run.

## Administrator update and live gates

The owner said the administrator completed the latest request. Anonymous
GET/POST/DELETE preflights now allow exactly`https://romdex-web.vercel.app` with
`authorization,content-type`. See the retained JSON and CORS-ORIGIN-HANDOFF.md.
This proves the preflight boundary, not authenticated reading or attachment
writes. The new hosted CORS test uses a deliberately invalid token and checks
that the real UI displays HTTP 401. It is prepared but has not run.

YouTrack remains the only application backend. Acceptance app 1.0.12, ID 155-84,
is Active only on NPCD, auto-attach OFF. Mutations only NPCD-872/NPCD-873. The
child race accepted both same-revision writers and lost one receipt; production
sharing stays OFF. Production source 1.0.8 remains withheld. No browser/process
lock or Vercel backend may substitute for supported native concurrency proof.
Keep PMON out of developer acceptance mutations.

Desktop 0.5.15 and its profile are unchanged. Two critical installed source hashes
still match the earlier checkpoint; see evidence preservation.json. No live
export/import, queue replay, PMON write or desktop replacement occurred.

## Hosting and first steps after resume

Current public shell is`https://romdex-web.vercel.app`, old worker
`42c42d7e7149f040f502`, source`76fa8990e7d0cdac2d273e452dc7d5b66da98b50`.
Existing Vercel project:`prj_lwS3eQ816VS2BCXZWO88rG4QWX3W`, PMON/pmon1,
Hobby, static Other preset, no app functions/proxy/database/env additions.
The owner approved GitHub integration only for ROMDex-Web and completed identity
verification. Production tracks this port branch; pushing it publishes updates.
Do not deploy the old main foundation. Vercel Toolbar and PR comments are OFF.

The newly available Vercel MCP returns 403 for scope pmon1; it needs scope access.
Do not claim it inspected the project successfully or retrieve secrets. The
existing approved Git deployment plus GitHub MCP commit status and hosted HTTP/
Playwright verification work without granting another connector permission.

After the owner resumes, inspect the clean checkpoint and remote tag, then push
the fully tested branch when ready to publish the UI repair. Verify Vercel's
status for that exact source commit, run the hosted suite, and preserve actual
hosted inventory/evidence. Independently built worker bytes differ because Next
build IDs change. Native authenticated acceptance, concurrency repair, actual
Windows installation and a reviewed desktop export/import remain cutover gates.

The owner asked which model fits: official OpenAI guidance supports Astra with
Extra High reasoning for the remaining sync-safety/migration work. Sol with High
is adequate for routine UI work. No model switch was performed by the agent.
