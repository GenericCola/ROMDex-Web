# Precise desktop task moves

The desktop reference is GenericCola/ROMDex at
28c0ce4d449e655661dd7469999a6dc56779f28f, specifically
apps/romdex/public/app.mjs (lines 321–364) and drop-target.mjs.

## Restored behavior

- An indented insertion arrow and line show the actual destination depth and
  boundary, including after an expanded subtree and within a scoped view.
  A noninteractive viewport overlay prevents the line from disappearing behind
  the footer when the last visible row reaches the scroll boundary.
- Feedback names the destination parent and the next sibling, instead of only
  reporting an absolute level number.
- Scrolling can proceed over an invalid target. The target is recalculated
  after the content scrolls, rather than displaying a pre-scroll destination.

## PC improvements

- Drag either a title or its grip. Ordinary title clicks, double-click rename
  and F2 remain available; mouse movement under 6px remains a click.
- A deliberate 26px horizontal step changes hierarchy level. The former first
  13px nesting threshold is removed. Hold Shift to place beside the hovered
  item. Pressing or releasing Shift updates the preview without mouse movement.
- Holding at the top or bottom edge keeps scrolling. Hovering on a collapsed
  parent while nesting opens its children after 650ms.
- Click the grip, or focus it and press Enter, for exact placement. Search
  parent paths or task IDs, select the parent, then choose a before-sibling
  position or the end. All Tasks returns a task to the top level.
- Escape, pointer cancellation or loss of window focus cancels the gesture.
  Cancelling an active drag suppresses the release click, preserving selection.

The original desktop did not have title dragging, stationary scrolling,
hover expansion or the exact-position dialog. Those are improvements, not
claims about restored desktop behavior. The source's expanded-subtree boundary
and existing selector ancestry expansion are retained.

## Data safety

The same hierarchy signatures, cycle validation, ticket locks, draft flush and
IndexedDB commit path are used for pointer and exact moves. Exact moves recheck
recovery mode, readiness and update state after waiting for draft saves. A stale
hierarchy is rejected rather than guessed. No user task data, credentials,
production queue or installed desktop state was used for testing.

## Verification

The release gate passed on QA commit
`2cf9b1f88fec6c8769573eeb88c06a21c5a65033`, with application source tree
`9b243c05af69b61cd3aaddfbeb59793e455aafe1`:

- `corepack pnpm build`: optimized production build and PWA generation passed.
- `corepack pnpm check`: source/test/server typechecks, lint, 689 unit tests,
  30 worker/build/hosting/YouTrack harness checks and 47 server tests passed.
- Chromium: 19/19 browser cases passed. Firefox: 19/19 passed.
- Suites: drag-precision, ui-layout, save-isolation and session-entry-flow.
- Browser coverage includes real mouse and keyboard interaction, stationary
  scrolling, hover expansion, Shift changes, cancellation, exact insertion,
  checked siblings, scoped guide geometry, draft flush and reload persistence.
- Chrome and Firefox screenshots were visually reviewed. The final blue arrow
  and insertion line remain fully visible at the bottom scroll boundary, and the
  exact-move dialog retains reachable labels, choices and actions.

The browser tests used synthetic intercepted sessions and tasks in an isolated
Vercel preview. No real task mutations or production queues were used. The QA
wrapper restores normal hosting configuration before building and is excluded
from the production branch. Do not promote the QA deployment directly.

Verified preview: https://romdex-jm6p8mtgt-pmon1.vercel.app
Deployment: `dpl_DhUCpeLeK2yy7vZBmXMBW2qFqcdW`.

Earlier diagnostics were retained rather than reported as passes. Historical
pre-cookie browser fixtures had obsolete sign-in/status assumptions. New pointer
cases initially aimed at coordinates hidden by the sticky header after scrolling;
actual browser hit tests identified the header/search bar, and the tests now
navigate the visible edge and await the intended destination. Screenshot review
then caught and corrected the scroll-boundary clipping before release.

No full five-browser matrix, physical Windows installed-app check, or live
production-task mutation is claimed. Local browser launch was unavailable, so
current browser evidence comes from the isolated preview build.
