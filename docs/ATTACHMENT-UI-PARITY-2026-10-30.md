# Attachment list parity

The verified desktop `attachment-view.mjs` (commit
28c0ce4d449e655661dd7469999a6dc56779f28f, blob
5ea0110dce2f4c87b191d2c4850596b3767234c5) uses the same per-file controls
in the Details tray and attachment dialog. The web Details tray previously showed
only filenames. Both surfaces now share native rows with View (safe raster only),
Download, Delete, and Cancel Deletion, alongside queued upload controls.

The original B/KB/MB formatting and single-row deletion states are restored.
Selecting an item reads its current attachment inventory into the existing
account-scoped cache. This does not download file bytes or dispatch a mutation.
Dialog opening and explicit refresh remain available. Cached metadata is kept
when reading fails; "No Cached Attachments" is distinct from a verified empty list.

Deletion still requires explicit confirmation and queues an operation for the
existing reviewed Save flow. Cancel Deletion is allowed only before any delivery
evidence exists. Cancellation retains the intent and native file metadata; a
linked RDX publication is marked as needing review, not falsely completed.
Ambiguous/sent deletions remain held. Missing native metadata cannot erase their
pending evidence. Existing safe previews, byte checks, download, recovery and
account/PWA work guards remain in place.

The managed browser fixture verified inventory loading in Details, one native
row, explicit local deletion staging, its Queued for Deletion state, and Cancel
Deletion restoring On YouTrack without any non-GET request. The actual expanded
Details layout was inspected. Fixture tests cover held outcomes, missing-file
evidence, cancellation receipts, RDX batch status and original size formatting.
No production file was deleted or uploaded for acceptance.

Remaining: initial Work Tray attachment badges depend on metadata already read
for an item; complete initial native inventory parity is not yet established.
External OS file-drop and live/cross-browser file acceptance remain separate.
