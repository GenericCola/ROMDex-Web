# Retry verification without discarding a valid tab sign-in

Local candidate based on live 9c1bcdde. No cookie, server session, refresh token,
new grant, localStorage credential or longer expiry is introduced.

Confirmed source defect: resume previously erased a valid saved tab session on
any identity/project/local-workspace failure and replaced the cause with a
forced-sign-in message. The teammate's canonical URL and immediate same-tab
refresh are confirmed, but the exact failure on that device is not established.
A stale cached shell remains a separate possibility; synthetic passing tests do
not establish the user's actual cached version or network response.

Recoverable verification/load failures now retain only the already-approved tab
session until its unchanged expiry. The signed-out gate offers Retry sign-in
verification and keeps identity/project data hidden until fresh checks succeed.
Typed HTTP401/403, identity/project mismatch and expiry reject the saved session.
Generation checks prevent stale retries from restoring or clearing a newer login.
Retry expiry still clears the original record. Storage failures are caught and
leave the gate closed; no raw response, token or credential is printed.

Local storage errors may require recovery or a reload; Retry does not promise to
repair persistent browser storage. Recovery-blocked sign-in/retry controls and
handlers remain disabled until local preservation succeeds. Interactive sign-in
clears an older retained in-memory expiry reference so it cannot cancel the new
flow. Logout and session delivery opt-in remain unchanged.

## Reconciliation clarity, without automatic replay

A failed delivery suspends Auto-Sync; successful review does not resume it. The
header now shows Paused while the saved switch remains On, with instructions to
review and explicitly Save. Deletion approval feedback names explicit Save
Changes instead of suggesting paused Auto-Sync will proceed. No suspension flag
is cleared by these changes. Manual Save results are tagged with their connection
snapshot so an old automatic-pause reason cannot hide a newer failure, and a later
pause is not masked by an old manual message. Fresh deletion checks remain intact.

## Evidence and limits

Synthetic non-owner production-hook tests under React StrictMode verify PMON and
other-project immediate reloads, offline refresh followed by retry without OAuth,
logout, and HTTP401 revocation. Delivery remains OFF. Unit regressions cover
retained expiry, cancellation/newer login, denied projects/accounts, storage
failure during retry feedback and recovery-blocked controls. No real task write,
queued deletion or teammate credential was accessed. Exact final aggregate and
browser-expiry results are in the local candidate receipt.
