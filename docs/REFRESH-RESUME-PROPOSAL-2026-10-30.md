# Refresh sign-in repair — October 30

Base: published v19, commit 7223d999ac875ab11a53f65444a78c70c2a023ad.
This isolated fix contains no held v28 synchronization changes.

## Cause and approved change

The OAuth response existed only in a React ref and module memory, both destroyed
by document reload. The owner explicitly approved retaining the existing
short-lived access token in this tab's sessionStorage and publishing this fix,
after the JavaScript-readable storage and browser-session-restore risks were
explained. No new credential, grant, refresh token, expiry extension, backend,
role, OAuth registration or security-setting change is introduced.

Only romdex.vercel.app stores the token, expiry, instance, user ID and selected
project ID under romdex.oauth.tab-session.v1. No password, refresh token, project
content or token is written to localStorage, IndexedDB, a server or build output.
Session storage survives reload and may survive browser session restoration;
an opener may initially copy it. This is not a hardware credential vault.

Reload verifies the current YouTrack identity and accessible projects, then uses
the existing permission-checked project opener before exposing any workspace.
An expired, revoked, mismatched or malformed record fails closed. Failed resume
clears its own record; cancelled old reads cannot erase a newer login. Project
switching clears the saved project before opening another. Logout removes the
record before local-save awaits; if storage deletion fails, logout reports the
failure rather than falsely claiming success. Failed local saves preserve work.
Expiry clears in-memory authorization immediately and attempts record deletion;
any undeletable expired record is independently rejected on the next reload.
Normal unmount clears in-memory authorization, not the tab's resumable record.

No delivery connection is restored and no queue is replayed. Local work remains
in its existing account/project namespace. Logout remains local ROMDex logout,
not server-wide revocation or a promise to clear another duplicated tab.

## Verification

Synthetic regressions cover record projection, expiry, malformed storage,
blocked storage, account/project permission loss, revoked responses, cancelled
reads preserving newer records, and expiry during project opening. The actual
cloud Chrome fixture runs the production hook with synthetic popup/GET replies:
selected project A survives document reload; switching to B survives reload;
delivery remains OFF. Logout/revocation and final aggregate results are recorded
with the release receipt. No physical Android or real task mutation is claimed.

Reference: https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage
