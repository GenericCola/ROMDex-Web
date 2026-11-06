# Precise desktop task moves

The desktop reference is GenericCola/ROMDex at
28c0ce4d449e655661dd7469999a6dc56779f28f, specifically
apps/romdex/public/app.mjs (lines 321–364) and drop-target.mjs.

## Restored behavior

- An indented insertion arrow and line show the actual destination depth and
  boundary, including after an expanded subtree and within a scoped view.
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

Source and test typechecks, full source lint, unit, server and worker/build checks
run on the candidate. The browser acceptance uses synthetic intercepted sessions
and tasks in an isolated Vercel preview because the local cloud sandbox cannot
launch Chromium. Chrome/Firefox results and the final release IDs will be recorded
once the release gate completes. No full five-browser matrix or physical Windows
installed-app check is claimed.
