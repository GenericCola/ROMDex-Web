# Desktop audit follow-up

## Delayed row navigation

The Work tray previously scheduled each row independently. A click followed by
opening Filters could select the earlier row underneath the dialog. The original
desktop app used one pending navigation intent and checked context before opening.

The web app now keeps one pending row intent. A newer pointer or keyboard action
cancels it. The callback checks workspace, scope, editing and modal state; unmount
removes its timer and listeners. Double-click rename and immediate keyboard
activation retain their existing behavior. Status choices also have one explicit
accessible name, rather than reading the lamp label and visible text twice.

## Missing local attachment bytes

A queued upload whose original bytes are absent now blocks only its own ticket.
The metadata remains recoverable, and unrelated changes can sync. This is a
pre-request local failure, not an uncertain upload result.

Connection Details offers the original-file picker and a local cancel action.
Restoration checks the existing hash, size and metadata, then keeps the upload
ready for explicit Save Changes. Cancel preserves the archived metadata and any
stored bytes, without contacting YouTrack. The marker cannot coexist with a
remote receipt or an attempted-upload baseline. Restoring bytes for a genuinely
uncertain request never clears that uncertainty or permits a resend.

The workspace must remain the same while a file is checked. Reopening retains
the local recovery state. Updates should be applied before using these new
recovery controls; older app code may reject the new validated record shape
rather than silently dispatch it.

## Open-editor recovery copies

Recovery copies now retain custom-field and tag identities, checked states and
all selected values, alongside existing control IDs and values. Original typed
task values remain in the exported workspace. Each capture has a unique identity,
so the exported file passes the same validation used for import and reopening.
These records remain recovery evidence; they do not automatically replay edits.

Early item-editor exports omitted that identity. A narrowly recognized old
item-editor record now receives a collision-safe identity during validation,
without changing its recorded fields. Other malformed records still reject.
Selections that an old export never recorded cannot be reconstructed; the
compatibility path does not invent missing checkbox or multiselect choices.

## Evidence boundary

Unit tests and desktop Chromium fixtures use synthetic tasks and files. They do
not delete or upload files on real user tickets. Physical Windows installed-app
launch and the operating system's file-picker Cancel interaction are not claimed
as tested. Final release evidence records exact source hashes and outcomes.
