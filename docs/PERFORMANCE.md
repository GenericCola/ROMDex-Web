# Performance and loading states (PMON-576)

The owner reported that the app felt sluggish, sometimes hung, had loaders
that weren't smooth, and had waits with no loader at all. This page records
what was measured, what was found, what changed and the numbers before and
after. The baseline is main at `8284337`.

## How it was measured

- **Build.** Production static export (`next build` plus `build-pwa.mjs`),
  served from `out/` by `scripts/serve.mjs` on a port in the 3200–3299 range.
  Service workers are blocked so every run starts the same way.
- **Data.** A synthetic PMON-sized project: 490 issues as 10 epics × 8 stories
  × 5 tasks, with descriptions of up to about 160 words, mixed states,
  priorities and complexities, served through the same cookie-session
  `/api/youtrack` route the app uses. The browser workspace record is about
  690 KB. No live YouTrack data was read or written.
- **Driver.** Playwright Chromium at 1440×900 runs a fixed script:
  1. Cold open and 20 s idle.
  2. Warm reload, then Expand All.
  3. Select a row, toggle one row, type 30 characters into Notes.
  4. Type 10 characters into Search, clear it, then Collapse All.
  5. Type 30 more Notes characters with the tree collapsed.
  6. 20 s idle, then switch to NPCDex and back.
- **Recorded per step.**
  - CDP `Performance.getMetrics`: task, script, style and layout time.
  - `longtask` entries: count, total and worst.
  - Event Timing: the worst input-to-paint delay.
  - IndexedDB put timings.
  - The YouTrack requests made.
- **Attribution.** CDP CPU profiles of Notes typing on a source-mapped build.
  The source maps were decoded to `src/` locations and the time attributed to
  calling components.
- **Bundle.** The chunk files referenced by `out/index.html` (what `/` loads
  before any interaction), measured raw and with `gzip -9`.
- **Machine.** A shared 2-core ARM VPS. Other work ran at the same time
  (load average 7–28), so absolute times vary by about 3× between runs. The
  final comparison therefore alternates the baseline build and the final build
  under the same load (A/B/A/B/A/B) and reports means. The first baseline below
  was taken while the machine was quiet. Treat the ratios, not the absolute
  milliseconds, as the result.

All timing numbers on this page were measured before the owner capped the
session's memory at 1.5 GB soft and 2 GB hard, which happened early on
2026-11-07. The quiet baseline was taken on the evening of 2026-11-06. The
paired runs finished at about 01:00 on 2026-11-07. Later runs under the cap
were functional tests only.

The scripts (`measure.mjs`, `profile.mjs`, `fixture.mjs`, `compare.mjs`) are
not part of the app. They lived in the session scratch area and are summarised
here so the method can be repeated.

## Quiet-machine baseline (main `8284337`, one run)

| Step | Wall ms | Long-task total ms | Worst long task ms | Worst input delay ms | Script ms | Style ms |
|---|---|---|---|---|---|---|
| Cold open to rows | 731 | 390 | 176 | – | 351 | 77 |
| Idle 20 s (collapsed) | – | 53 | 53 | – | 10 | 1074 |
| Warm reload to rows | 513 | 190 | 116 | – | 236 | 59 |
| Expand All (490 rows) | 1766 | 1536 | 1257 | 1376 | 663 | 654 |
| Select a row | 913 | 1210 | 252 | 200 | 995 | 245 |
| Toggle one row | 1671 | 1351 | 405 | 504 | 1021 | 350 |
| Type 30 chars in Notes (expanded) | 9510 | 8661 | 484 | 680 | 7860 | 886 |
| Type 10 chars in Search | 4051 | 3209 | 321 | 392 | 2786 | 306 |
| Clear Search (remount 490 rows) | 2643 | 3270 | 2391 | 2600 | 1754 | 929 |
| Collapse All | 3578 | 1757 | 367 | 544 | 1687 | 253 |
| Type 30 chars in Notes (collapsed) | 6182 | 5492 | 313 | 392 | 5581 | 182 |
| Idle 20 s after typing (collapsed) | – | 2001 | 135 | – | 1730 | 1334 |
| Back to ROMDex from NPCDex | 1191 | 983 | 605 | 704 | 908 | 114 |

The initial JS for `/` was 14 chunks, 1,185,924 bytes raw and 357,420 bytes
gzip.

## Findings, ranked by measured impact

1. **Each store change re-derived the whole task tree several times.**
   - **What happened.** Every workspace change re-ran `materialize()` 5 times:
     in Romdex, TaskAttachmentProvider (even with no dialog open),
     TaskProperties, DetailNavigationProvider and `editTask`. It also re-ran
     `indexTree()` 7 times. Each `materialize()` call deep-clones all 490
     tasks. A Notes keystroke is one such change.
   - **Profile.** While typing in Notes with the tree collapsed, materialize
     took 1.5 s, indexTree 0.75 s and React itself 0.14 s. That is about
     150 ms of script per keystroke.
2. **Task rows were never skipped.**
   - **What happened.** Each `WorkRow` received the whole workspace, a fresh
     tree and fresh callbacks. The detail-navigation context value was new on
     every render. So every store publish re-rendered every visible row, about
     41 elements each.
   - **Measured.** With 490 rows expanded, a Notes keystroke cost about 280 ms
     and Search about 300 ms.
3. **Status bulbs repainted every frame for ever.**
   - **What happened.** The pulse and blink keyframes animated `background`
     and `box-shadow`, which can't run on the compositor.
   - **Measured.** An 8 s idle trace showed 471 frames, each with style
     recalc, paint and commit: about 3 s of main-thread work. The main thread
     was 35–40% busy while the app sat idle.
4. **The initial bundle included everything.** `/` loaded the RDX and NPCDex
   schemas, the `buffer` polyfill and `@noble/hashes` sha256. None of these are
   needed to show or edit tasks.
5. **Each save writes the whole 690 KB workspace.**
   - **What happens.** Every change runs `structuredClone`, then
     `validateWorkspace`, then one IndexedDB put with strict durability.
   - **Measured.** During fast typing the puts queued behind the busy main
     thread, and some landed more than 20 s after typing stopped.
   - **Result.** This is the durability path. It was left as it is, apart from
     the structural sharing below. See "Not changed".
6. **Background sync re-reads all issues every 5 s.**
   - **What happens.** While the window is visible, incoming sync reads the
     full PMON issue list every 5 s: 5 pages of 100 with full fields,
     36 requests per 20 s idle. It applies the result every 3 s.
   - **Result.** This is sync logic in `src/cloud`, which another lead owns,
     so it is reported here rather than changed.
7. **Mounting 490 rows at once is slow.** Expand All and clearing a search
   take a single 1.2–2.4 s task, mostly style recalc and layout for about 20k
   elements. Memoized rows don't help with the first mount. See "Not changed".

## Fixes

| Commit | Change |
|---|---|
| `e762fc7` | **Status bulbs.** The lit layer now fades over a dim face using `opacity` only, so the animation runs on the compositor. Keyframe names, endpoints and the reduced-motion face are unchanged. Mid-pulse frames differ slightly: the glow fades rather than grows. |
| `24dea01` | **Structural sharing.** Store writes reuse unchanged subtrees (`src/domain/share-structure.ts`). If only the view changed, `remote`, `operations` and `order` keep the same identity. Saved data and save cadence are unchanged. |
| `27faeb8` | **Derive once.** `src/domain/workspace-derived.ts` caches the derived task list and tree once per snapshot for every render-path caller, and reuses unchanged task objects. |
| `b56dc19` | **Memoized rows.** `WorkRow` is memoized. Its props are per-row values plus a lock key that covers the global edit-lock inputs read during render (snapshot error, recovery mode, reviewed and delivering tickets). Callbacks and the detail-navigation context are stable. |
| `78f8a86` | **Copy-on-write derivation.** The UI applies queued operations copy-on-write. Its output equals core `materialize()`, checked in 400 seeded random cases. When ids, parents, states and order are unchanged, it reuses the tree's depth and colour maps instead of re-sorting. |
| `94da924` | **Edit base lookup.** `editTask` finds the edit base through the copy-on-write materializer and still stores a private copy. |
| `5a0eb48` | **Lazy loading.** NPCDex, Connection, Migration, the RDX library, Update check, Tile settings and the item editor load with `next/dynamic` behind the shared loading UI. The RDX plan host and the tile image decoder load on first use. `build-pwa.mjs` already precaches every chunk, so lazy views still open offline. |
| `88abf5e` | **Result messages.** A finished result message replaces the shared loader at once instead of waiting out the 400 ms minimum display. Found through a Firefox run of the save-light test, which has a 1 s timing margin. |
| `a908c48` | **Loading states.** Shared delayed loading, skeleton and empty states. See below and docs/DESIGN.md. |

Micro-benchmark for 490 tasks with one description edit per keystroke:
`workspaceItems` plus `workspaceTree` went from 39.7 ms to 1.8 ms.

## Results

### Bundle

| | Chunks on `/` | Raw bytes | Gzip bytes |
|---|---|---|---|
| Before (`8284337`) | 14 | 1,185,924 | 357,420 |
| After | 15 | 926,860 | 291,520 |

That is 22% less raw and 18% less gzip. None of the RDX schema, the Buffer
polyfill or the sha256 constants remain in the initial chunks.

### Paired runs under the same load

Means of three alternating runs per build (baseline `8284337`, final
`94da924`). Both builds ran under the same load, so the absolute values are
higher than in the quiet baseline above. For the two idle rows, the first
column is total main-thread task time over the 20 s instead of long-task
total.

| Step | Long-task total ms | Change | Worst long task ms | Worst input delay ms | Script ms |
|---|---|---|---|---|---|
| Cold open to rows | 1546 → 645 | -58% | 520 → 203 | 0 → 0 | 984 → 323 |
| Idle 20 s (collapsed): main-thread task time | 9746 → 1011 | -90% | 166 → 171 | – | 29 → 13 |
| Warm reload to rows | 948 → 371 | -61% | 374 → 197 | 0 → 0 | 748 → 240 |
| Expand All (490 rows) | 4618 → 4547 | -2% | 3462 → 4091 | 3827 → 4504 | 2009 → 1303 |
| Select a row | 4566 → 1189 | -74% | 920 → 270 | 568 → 533 | 3119 → 403 |
| Toggle one row | 3943 → 2227 | -44% | 1127 → 792 | 1469 → 1192 | 2058 → 613 |
| Type 30 chars in Notes (expanded) | 23792 → 7483 | -69% | 1295 → 370 | 1456 → 701 | 19315 → 3790 |
| Type 10 chars in Search | 6439 → 1959 | -70% | 730 → 288 | 973 → 523 | 5055 → 1404 |
| Clear Search (remount 490 rows) | 3880 → 2957 | -24% | 2626 → 2494 | 2880 → 2928 | 2063 → 1112 |
| Collapse All | 2637 → 1067 | -60% | 674 → 522 | 843 → 824 | 2333 → 905 |
| Type 30 chars in Notes (collapsed) | 9152 → 1339 | -85% | 465 → 143 | 653 → 397 | 8985 → 2361 |
| Idle 20 s after typing: main-thread task time | 13714 → 2082 | -85% | 230 → 211 | – | 4800 → 14 |
| Switch to NPCDex | 754 → 480 | -36% | 328 → 146 | 565 → 323 | 416 → 286 |
| Back to ROMDex from NPCDex | 1451 → 703 | -52% | 586 → 307 | 792 → 544 | 1214 → 369 |

- **Typing and search.** These were the "sluggish" paths. Long-task time is
  down 69–85%, and the worst single long task while typing fell from about
  1.3 s to under 0.4 s.
- **Idle.** Main-thread work while idle is down 85–90%. Most of this is the
  status-bulb animation, which no longer repaints the page every frame.
- **Expand All and Clear Search.** These mount all 490 rows at once and are
  unchanged within noise. Memoization can't help the first mount; see "Not
  changed".
- **Remaining keystroke cost.** In the final profile, what is left per Notes
  keystroke is the store write path: workspace clone, validation, structural
  sharing and the IndexedDB put. The incoming-sync apply step adds to it. React
  rendering is now negligible.

## Loading, empty and error states

There was no shared loader. Waits used one of three patterns:

- a `<p role="status">` inserted above content, which moved it;
- a disabled button with no visible cue;
- a label swap ("Moving…", "Reading…", "Signing in…").

Every loader showed on the same render as `busy`, so it flashed on fast
IndexedDB reads.

The new shared approach is documented in docs/DESIGN.md under "Loading
states". It has these parts:

- `useDelayedFlag`: shows a loader after a 250 ms delay and keeps it for at
  least 400 ms.
- `Pending`: an always-reserved `role="status"` line.
- `WorkspaceSkeleton`: placeholder blocks that pulse with opacity only.
- Label swaps on the button that started the work.

Inventory of waits and what changed:

| Wait | Before | Now |
|---|---|---|
| Sign-in and workspace open (AuthGate) | Card text "Opening ROMDex…" | Unchanged; already smooth |
| Workspace not ready / project switch | Blank area under the header; inert with no cue | Delayed workspace skeleton; inert workspace is dimmed with `cursor: progress` |
| Migration import (read, hash, verify, apply) | No loader at all | "Reading and verifying the file…" / "Importing reviewed data…" in a reserved line |
| Detail attachments first read | False "No Cached Attachments" while reading | "Reading attachments…"; empty text only after the read |
| Task attachments dialog | "Attachment operation in progress" | Same shared Pending line, "Working on attachments…" |
| Comments read | Status paragraph inserted above the list, with "No comments yet." under it | One reserved, delayed "Reading Comments…" line; empty text hidden while reading |
| Row Edit / Status freshness check | Disabled button with only a `title` change | Delayed `aria-busy` and a small ring next to the button; names unchanged |
| RDX library | "Validating RDX file…" for every operation | Operation-specific labels: validating, merging, saving, exporting |
| Update check | Spinner mounted and unmounted, so the dialog resized | Spinner slot reserved; spinner still shows only while checking |
| Delete review / Tile settings apply | Buttons disabled only | "Deleting…" / "Applying…" label swap |
| Lazy dialogs and NPCDex | Not applicable (eager) | Shared Pending while the view's chunk loads |
| Move task, Connection read, Sign-in | Label swap | Unchanged (the pattern the rest now follows) |
| Save Changes, delivery review, shared-status preview, local-upload review, file drop, recovery export | Disabled controls; messages in the save notice | Not changed in this pass. They are tied to delivery and sync state. They still give no visible in-flight cue beyond disabled controls, and are listed as open work |

## Not changed, and why

- **Save coalescing.** Done later in PMON-640 (owner answer P1): changes now
  wait 200 ms and share one put of the newest snapshot
  (`src/domain/save-queue.ts`). Each change's save promise still resolves only
  after a put that includes it, and a waiting save starts at once on flush,
  delivery, app update, page hide and `beforeunload`.
- **Per-change cost of the write path.** Each store change still runs
  `structuredClone` on the workspace, `validateWorkspace` (including
  `indexTree`) and a full-record IndexedDB put. After the fixes these, plus
  the incoming-sync apply step, are most of the remaining Notes keystroke
  cost. Reducing them means changing the storage format, for example a record
  per task, or the validation contract. Both belong with the storage work.
- **Full re-read every 5 s.** Removed in PMON-641 (owner answer P3): incoming
  sync no longer polls. See docs/SYNC-WITHOUT-POLLING.md.
- **Row virtualization.** Expand All with 490 rows still mounts every row in
  one task. Virtualizing the table would interact with drag precision, exact
  insertion guides and keyboard navigation, which have their own acceptance
  suite, so it needs a separate, focused change.
- **Tile images (done).** The image bytes now live in their own IndexedDB
  database (`romdex-web-images`) and the workspace record keeps only a short
  ref per image, so clone, validation and save no longer carry them. Entries
  there are never deleted, so unused images still take browser storage. See
  `docs/YOUTRACK-STORAGE.md`.

## Verification

Final tree, `88abf5e` plus this document:

- `pnpm check` passed:
  - typechecks and lint;
  - 713 unit tests;
  - 30 worker, build, hosting and YouTrack harness checks;
  - 47 server tests.
- `pnpm build` passed.
- Browser tests ran under the memory cap with the shared lock: one worker and
  one project at a time, Chromium then Firefox.
  - **Chromium:** 54 passed, 39 failed. 38 of the failures are the same tests
    that fail on main `8284337`. That set was confirmed test by test against
    a baseline run earlier in this session. The final run's failures match it
    file by file. The remaining one
    (`attachments.spec.ts:322`, waiting on parent-status rollup) passed 3 of 3
    times when run alone. It also passed in both earlier full Chromium runs of
    this branch, so it is a timing flake, not a regression.
  - **Firefox:** 54 passed, 38 failed, 1 skipped. The 38 failures are the
    same set as on main.
  - **The 38 known failures:** delivery (2), desktop-migration (5),
    foundation (1), notes-editing (3), pwa-install (2), rdx (3),
    shared-status (4), status-delivery (4), status-dialog-sync (1),
    structural-delivery (4), task-filters (3), task-port (5) and
    task-update (1). These are the pre-cookie fixtures that open `/` without
    the sign-in session or wait for the old "Assigned Status" control. They
    belong to the e2e repair work, not to this change.
  - **WebKit and the mobile projects:** an earlier full run reached them
    before the memory cap. WebKit failed to launch on this ARM host because
    the system libraries are missing (`playwright install-deps`). That is an
    environment limit. The mobile and iPhone projects weren't rerun under the
    cap.
- **Save-light timing.** One Firefox run of `save-isolation.spec.ts:188`
  showed that the loader's minimum display delayed result messages. That test
  checks the light at 599 s of a 600 s window, so it has a 1 s real-time
  margin. Fixed in `88abf5e`; it then passed 4 of 4 runs alone.
