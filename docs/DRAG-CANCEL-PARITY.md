# Drag cancellation parity

Active task drags suppress the following click for 350 ms after Escape or pointer
cancellation, matching the original desktop finish-drag behavior. A canceled drag
must not change selector scope, commit a move, or clear a checked selection.
Below-threshold gestures remain ordinary clicks. Normal completed drags retain
the same suppression window.

Seven deterministic tests exercise the actual drag hook, selector callback and
workspace store with test React primitives and pointer geometry. They cover active
Escape/pointer cancellation, bulk selection, ordinary completion, inactive
controls and expiry. These tests model release-click propagation; they do not
claim that a native browser emits a click after pointer cancellation.

The desktop Chromium regression separately verifies ordinary mouse reorder,
subsequent title activation and selector navigation. Native mid-drag Escape and
blur remain unverified because the available browser interface only exposes a
complete drag gesture. No geometry, touch handling or delivery behavior changes.
