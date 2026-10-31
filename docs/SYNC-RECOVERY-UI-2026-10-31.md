# Clear sync recovery and stable layout

This repair separates readable recovery actions from the fixed app header.
Connection Details remains available from its existing connection light; no new
header button or expanding status banner is added.

- Related dialog actions share a 10px wrapping gap. Checkbox labels have a
  separate gap. Compact row icons, tabs and selector controls retain their
  established layout. A source inventory test detects unclassified action groups.
- A reviewed change offers SAVE CHANGE; multiple changes use an accurate count.
  Unknown request outcomes require a read-only check before another save.
- When a ticket has saved but parent status work remains, the UI says so and
  offers SAVE STATUS UPDATES rather than claiming the queue is empty.
- The Save light and its explanation share one pending-work calculation. Errors,
  drafts, queued changes and pending parent updates are not hidden to make it
  green. Local persistence remains yellow. A fully completed save is green.
- A new failed manual save replaces stale earlier failure feedback. Successful
  review clears its obsolete failure text without enabling automatic delivery.
- Incoming read failures identify their stage and safe failure category in
  Connection Details; arbitrary response bodies are never displayed. Superseded
  reads retry without presenting an expected cancellation as an error.

Verification includes a synthetic confirmed child update followed by a failed
parent read: the child is not resent, parent work remains pending, and a later
successful save completes it and clears the Save light. Browser verification uses
fixture-only transport and production CSS. It does not prove the cause of an
individual user's live read failure; that remains a separate diagnosis. No queue,
attachment, permission, or uncertain-request safety guard is removed.
