# Disconnected delivery controls

The desktop screenshot showed delivery disconnected, not a failed Auto-Sync
scheduler: Enable delivery was available and Disconnect was disabled. Signing in
or resuming the approved tab login does not automatically enable write delivery.
A later user screenshot showed Auto-Sync On; that alone does not prove remote
changes were confirmed.

The header now opens Connection Details when its disconnected Auto-Sync control
is activated, rather than leaving an unexplained disabled control. It becomes a
switch only when delivery is connected. A saved On preference is displayed as
Paused while disconnected. Opening details does not connect, change preferences,
or send operations. Existing explicit session opt-in and queue safeguards remain.

Save Changes exposes its actual local error, pending local write, editor draft,
queued operation count, or parent-rollup reason through its tooltip and accessible
name. An empty local queue is not presented as proof that all remote data is fresh.
No styles, account/session storage, delivery scheduler, or writer behavior changes.

Verification: focused regression covers disconnected and connected semantics and
all Save reasons. A synthetic queued-comment browser fixture reproduced the red
Save lamp; keyboard Enter on disconnected Auto-Sync opened Connection Details,
with Disconnect still disabled. No real YouTrack request or task mutation was used.

## Conflict review and browsing

The previous DeviceBody inert condition disabled both task trays for every
unconfirmed delivery record, including a ready record. The fix permits view-only
navigation while centrally rejecting task, draft, queue and journal changes.
Existing in-flight delivery, update and local-storage-error locks remain. Normal
queue edits resume only after review resolution; existing account-bound delivery
transactions still own that resolution. Fresh comments and attachment inventories
can be displayed transiently during review, with identity/request guards, without
rewriting operation baselines. Editing fields are read-only or disabled.

Primary deletion conflict text identifies the issue/title and changed fields,
including status and added comment count. Technical JSON is collapsed. Keeping
tasks cancels remaining deletion after readback; already-confirmed earlier deletes
are not undone. Reapproving remaining deletion needs an explicit checkbox tied to
the displayed record, then the existing fresh comparison. No review action sends
DELETE. A changed snapshot still requires another review.

Synthetic browser proof: Epic click and task keyboard Enter work during conflict;
fresh comments render while the task title is read-only. Keep/cancel reads the
synthetic task, removes only the pending deletion, restores its row and clears the
review notice. The fixture rejects all non-GET requests. Actual user task outcomes
were not changed or inferred.

## Tray 1 triangle

Recovered desktop selector-view.mjs/styles.css and the web both used a20px ▸ glyph
inside an18px target. The installed desktop's exact font-rendering baseline is not
available. Following the user's explicit smaller-triangle request, this batch uses
a12px visible glyph, independent24px desktop/28px phone target, unchanged center,
expanded-state rotation and accessible controls. This is an intentional correction,
not a claim that12px was found in the recovered desktop source.
