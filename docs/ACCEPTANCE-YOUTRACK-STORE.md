# Browser acceptance of the YouTrack store (PMON-575)

Checked on 2026-11-07 on branch `feat/youtrack-storage`, against a local
production build (`out/` from `pnpm build`) served by the e2e preview. The store
itself is described in [YOUTRACK-STORAGE.md](YOUTRACK-STORAGE.md).

Fixture results and live results are kept apart below. No live check was run
in this phase.

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

Results: all 7 tests passed on chromium and on firefox in the worker's runs,
and all 7 passed again in the full chromium run below. Mobile-chromium was not
run before the phase was paused.

WebKit and the iPhone project cannot run on the test host (Ubuntu 26.04 arm64):
Playwright's WebKit needs system libraries that require `sudo apt-get install`.
They were not installed.

## Live results

None in this phase. The live round trip of PMON-572 (test articles in TST)
remains the only live store check; see YOUTRACK-STORAGE.md. A browser live
check needs a signed-in session, and OAuth sign-in starts only at
https://romdex.vercel.app (`src/auth/origins.ts`), which still serves `main`
without the store.

## Vercel

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

Results after the repair (`E2E_PORT=3450`, one worker, local build of the
branch):

| Project         | Passed | Failed | Skipped | Notes                                                                 |
| --------------- | ------ | ------ | ------- | --------------------------------------------------------------------- |
| chromium        | 95     | 6      | 0       | Full run, 10.3 min                                                    |
| firefox         | 65     | 2      | 0       | Stopped after 67 of 101 tests to free memory; not rerun yet          |
| mobile-chromium | -      | -      | -       | Not run yet                                                           |
| webkit, iphone  | -      | -      | -       | Cannot run on this host                                               |

The 6 chromium failures are not test faults:

- `shared-status.spec.ts` (4): the shared assigned status controls are no
  longer rendered (3678a4d); the tests stop at "Preview shared assigned
  status". Owner question 2 in PMON-622.
- `structural-delivery.spec.ts` "a detached move…": after a lost move response
  the review offers no way to queue the remaining parent link again (PMON-611,
  owner question 3).
- `status-delivery.spec.ts` "a parent's own status…": intermittent, the parent
  is not recalculated after its last child is deleted (PMON-612).

The 2 firefox failures so far are the first two shared-status tests. The
repair workers also saw `task-port.spec.ts` "…offline reopening" fail on
firefox only: with any Playwright route active, Firefox bypasses the service
worker, so the offline reload cannot be tested with a routed session.

Open app questions are tracked in PMON-611, PMON-612 and PMON-613.
