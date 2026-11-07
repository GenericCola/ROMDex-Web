# Browser acceptance of the YouTrack store (PMON-575)

Checked on 2026-11-07 on branch `feat/youtrack-storage`, against a local
production build (`out/` from `pnpm build`) served by the e2e preview. The store
itself is described in [YOUTRACK-STORAGE.md](YOUTRACK-STORAGE.md). The final
runs below are on 1accb69, after the merge of the performance work (273bc2a)
and the production cutover ([CUTOVER-2026-11-07.md](CUTOVER-2026-11-07.md)).

Fixture results and live results are kept apart below. The only live check is
a read-only one from Node; no browser has run against live YouTrack.

## Fixture results

`tests/e2e/store-acceptance.spec.ts` runs the real app in the browser with a
synthetic cookie session. `tests/e2e/store-fixture.ts` answers the app's proxy
routes (`/api/youtrack?route=articles…` and `/api/attachment?article=…`) from
the in-memory YouTrack the unit tests use (`tests/fixtures/fake-youtrack-store.tsx`).
Several browser contexts can share one fake, so each context is a separate
device. Seeding and read-back use the real store code in `src/store/core`.

| Test                                    | What it shows                                                                                                                                                                                                                                                   |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First sync on a fresh device            | A device with no base takes YouTrack's values (Fixture Root shows "In Development"), reports "Synced with YouTrack.", and every seeded `assigned` and `orders` key is still in the article afterwards. No DELETE is sent.                                         |
| Two devices, different keys             | Device A sets Fixture Root, device B sets Fixture Other. After one more sync both pages show both values, the article holds both, and nothing goes to review.                                                                                                    |
| Conflict and review                     | Both devices change the same key. B shows "Needs review: 1 changed on two devices.", the review list and the notice outside the dialog, and shows YouTrack's value. Keep mine writes B's value. A second conflict settled with Keep YouTrack's sends no content write and no upload. |
| Offline then online                     | Offline, the status reads "Saved in this browser; waiting to sync." and nothing reaches the fake. Back online, the `online` event syncs and the article holds the change.                                                                                       |
| Part over 4 MB                          | A 4.2 MB task image brought in through Import Desktop or Recovery Data is refused with the exact message from `tooLargeMessage`. The image is never uploaded; the other parts still sync and the manifest revision moves on.                                      |
| Set up in YouTrack…                     | With no article, the confirmation text appears, Cancel sends nothing, and Create article sends exactly one `POST articles` for "ROMDex data" in project 0-1 with LimitedVisibility for 2-1 and 2-2. The store then syncs.                                         |
| Production CSP                          | The document is served with the headers from `vercel.json`. A full sync with uploads and downloads raises no `securitypolicyviolation`. A control request outside `connect-src` is reported, so the listener works.                                                |

Results: all 7 tests passed on chromium, firefox and mobile-chromium in the
full runs below.

WebKit and the iPhone project cannot run on the test host (Ubuntu 26.04 arm64):
Playwright's WebKit needs system libraries that require `sudo apt-get install`.
They were not installed.

## Live results

Read-only check of the production articles, 2026-11-07 (PMON-626). A Node
script read both articles with the store core: `readArticle` and `readStore`
over `tokenTransport`, then `rebuiltHash` from `scripts/migration/write.mjs`.
A wrapper refused any request other than GET; it made 51 requests, all GET.

| Article                     | Manifest revision | Parts | Rebuilt hash                                                       |
| --------------------------- | ----------------- | ----- | ------------------------------------------------------------------ |
| PMON-A-3 "ROMDex data"      | 1                 | 2     | `4e4577c6538c6f0c2e32848c42daec80ab9ceb0d985dd2c3a11874c0486e3148` |
| NPCD-A-1 "NPCDex data"      | 1                 | 47    | `2c50ee40f590eb1505a99922efa948db282fe46425bf640b5a0f69fc780c630c` |

Both hashes match the cutover record, and no part was unavailable.

The live write round trip of PMON-572 (test articles in TST) is still the only
live write check; see YOUTRACK-STORAGE.md. A browser live check needs a
signed-in session, and OAuth sign-in starts only at https://romdex.vercel.app
(`src/auth/origins.ts`), which still serves `main` without the store.

## Vercel

Still pending owner question A1 in PMON-622 (PMON-608). Nothing changed here
in the final phase.

- **No preview of this branch exists.** Vercel builds pushed branches of
  GenericCola/ROMDex-Web, but both pushes of `feat/youtrack-storage` (c5e00c8,
  85ee172) were refused: "Git author theGobindSingh must have access to the
  project on Vercel to create deployments." `main` (8284337, authored by
  GenericCola) deployed normally.
- **To get one:** give theGobindSingh access to the Vercel project
  (pmon1/romdex-web) or have GenericCola redeploy the branch, then run the
  hosted specs with `ROMDEX_HOSTED_ORIGIN=<preview origin> node
  scripts/playwright.mjs test -c playwright.hosted.config.ts`. A preview origin
  cannot start OAuth sign-in, so only the shell checks apply there.
- **CSP.** `connect-src 'self' https://thegobindsingh.youtrack.cloud` covers
  the store's calls: the cookie session uses same-origin `/api/youtrack` and
  `/api/attachment` (both rewritten to `api/index.ts`), and token mode calls
  YouTrack directly. `img-src` allows `blob:` and `data:` for images rebuilt
  from parts. Web Locks, IndexedDB and `CompressionStream` are not governed by
  CSP. https://romdex.vercel.app sends the same CSP as `vercel.json`.
- **Upload size.** The 4,000,000-byte part limit matches the proxy's cap in
  `server/youtrack.ts` and stays under Vercel's request body limit for
  functions.

## E2E suite repair

Most of the suite failed on `main` (8284337) as well: 39 of 93 chromium tests
that ran. The specs had not followed three app changes:

1. Cookie sign-in (3678a4d). `page.goto("/")` on the preview origin stops at
   "Sign in with YouTrack at romdex.vercel.app", and token entry is gone. Specs
   now open the app through the cookie fixture or `tests/e2e/local-workspace.ts`.
2. Desktop UI parity (7223d99, bb27317, 9608145). The Assigned Status and Task
   Parent selects left the details pane; status is set in the Set Status popup
   and parents in the exact-move dialog (`tests/e2e/task-status.ts`). RDX and
   update checks moved under TOOLS; import, export and the local save status
   show only in recovery mode (`?recovery=1`).
3. Review wording (334a970, 5d1b089). For example "Read back and confirm; do
   not resend" is now "Check whether this saved".

The preview port is now `E2E_PORT` (default 3100).

Results after the repair, before the merge (`E2E_PORT=3450`): chromium 95
passed and 6 failed; firefox stopped after 67 of 101 tests.

## Final e2e results

Full runs of the suite on 1accb69, one project at a time, one worker,
`E2E_PORT=3410`:

| Project         | Passed | Failed | Skipped | Notes                                                      |
| --------------- | ------ | ------ | ------- | ---------------------------------------------------------- |
| chromium        | 95     | 2      | 0       | 5.0 min. Store acceptance 7 of 7.                          |
| firefox         | 94     | 2      | 1       | 6.3 min. Store acceptance 7 of 7. Restart test is Chromium-only. |
| mobile-chromium | 94     | 2      | 1       | 4.9 min. Store acceptance 7 of 7. Desktop-geometry test skipped. |
| webkit, iphone  | -      | -      | -       | Cannot run on this host                                    |

The same two tests fail on all three projects, and nothing else does. An
earlier full run on 93c0795 gave the same picture, except that chromium and
mobile-chromium still passed the offline test through the fixture (see below).

Known failures, both waiting on the owner:

- `structural-delivery.spec.ts` "a detached move needs explicit rebase…": after
  a lost move response the review offers only Keep YouTrack, so the remaining
  parent link cannot be queued again (PMON-611, owner question 3). Fails on
  every project, on `main` too.
- `task-port.spec.ts` "…offline reopening": offline, the app stops at
  "Connection needs attention" because the cookie session check needs the
  network, so saved notes and drafts cannot be opened (PMON-628, owner
  question 9). Before 1accb69 the spec kept its fixture routes while offline:
  they still answered the session request, so Chromium passed, and in Firefox
  routed requests skip the service worker, so Firefox failed. The spec now
  drops the routes for the offline step and fails everywhere.

Skips are browser gates written into the specs: the persistent-profile restart
test runs on Chromium only, and the desktop-geometry test needs a wide window.

Changes in the final phase:

- The 4 shared-status specs and the unused shared-status UI were removed
  (90fe786): assigned status lives in the "ROMDex data" article (PMON-622
  answer 2). See SHARED-STATUS.md.
- PMON-612 is fixed. Two causes: the status-delivery spec clicked a row and
  then its move grip at once, which cancels the delayed row open, so it deleted
  Fixture Root instead of the moved child (a75fb51, test). And an incoming read
  that started during a delivery could apply after it with the tasks as they
  were before, putting a deleted child back and leaving "Parent status
  calculation pending." (93c0795, app: the delivery epoch now also moves when a
  delivery ends). "a parent's own status…" then passed 10 of 10 on chromium and
  10 of 10 on firefox. The `attachments.spec.ts` flake with the same message
  passed 20 of 20 after the fix, but also 20 of 20 before it, so it is likely,
  not proven, the same bug.
- No merge regressions: the chromium run on 2cb05c6, right after the merge,
  had the same 6 failures as before it.

WebKit and the iPhone project still cannot run on this host (owner question
A2).

Open app questions are tracked in PMON-611, PMON-613, PMON-628 and PMON-622.
