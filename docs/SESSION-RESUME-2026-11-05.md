# Session resume candidate, November 5

This cloud-only candidate is prepared for a nonproduction preview. It changes no
live grants, credentials, account settings or YouTrack data. Production remains
unchanged; browser acceptance gates must pass before release.

## Opening the project

A verified cookie session selects the account's last authorized project. Without
a valid saved choice it opens PMON when authorized, then the only project if
exactly one is available. Otherwise it shows the chooser. Every open rechecks
identity and project access before reading the workspace. Another account's
preference cannot select this account's project.

Cookie authentication does not depend on localStorage or sessionStorage while
access remains valid. Failed cleanup of the legacy tab token no longer blocks a
valid server session. Only nonsecret project preferences and renewal-attempt
markers are kept in localStorage. Workspace and queue persistence checks are
unchanged. Failed draft saving still blocks account switching or automatic
renewal after active-session expiry.

## Keeping this device signed in

A new, initially unchecked choice reads “Keep me signed in on this device
(30 days).” Only a new sign-in with that choice requests offline OAuth access,
using the existing public client, PKCE and YouTrack scope. Existing online
sessions retain their original expiry and do not acquire refresh authority.
Production enablement and creation of a real grant require separate approval.
If YouTrack omits the requested refresh token, sign-in remains access-only and
a notice explains that it will expire normally.

The ordinary access cookie still expires no later than the upstream access
token and existing one-hour limit. A separate encrypted Secure/HttpOnly cookie
holds the renewal credential, original account and generation binding, fixed
30-day deadline, and rotation ID. Credentials never enter JavaScript-readable
storage or API JSON. There is no database, paid service or new OAuth scope.

GET /api/auth/session verifies live identity and projects for usable access. An
expired or missing access cookie can instead receive a nonsecret renewal
challenge when the renewal envelope is still valid. Upstream denial with a live
access token does not silently trigger renewal. POST /api/auth/renew requires
same-origin checks, CSRF and the exact rotation ID. A successful response is
followed by a fresh session read before opening the workspace.

The browser holds a same-origin Web Lock while renewing and rereads access after
acquiring it. Before POST it records and rereads a nonsecret localStorage attempt marker keyed
by generation and rotation ID. While that marker remains available, a lost response,
reload or retry cannot automatically send that rotation again. Browser storage
clearing or eviction can remove this best-effort client guard; it is not a
server-enforced consumed-token ledger. A successful fresh access read can recover another
tab's success. Markers retain the original deadline. Only other conclusively expired markers
are collected; current, unexpired or malformed markers are never removed to
justify retrying a grant. Missing Web
Locks or unavailable marker storage requires another sign-in rather than an
unsafe renewal attempt. Valid access still works without those optional APIs.

At active-session expiry, delivery disconnects and local work is flushed before
resuming. A failed flush keeps recovery available and blocks renewal. A logout or
account-generation change cannot trigger renewal of the previous account.

## Limits that remain

This is bounded, best-effort persistence, not a guarantee of uninterrupted
sign-in. Provider revocation, a lost rotation response, unavailable browser APIs
or concurrent server requests can still require sign-in. Renewal itself does not replay mutations. Reconnecting delivery can resume
previously enabled autosync for eligible ready operations. Existing delivery guards
continue to block operations marked attempting or uncertain. Failed renewal
requests never clear or rewrite cookies.

Browser locks reduce routine tab races; they are not a Vercel-wide lock. Security
comes from encrypted account, generation and deadline binding. The stored session
ID is not a cross-cookie consistency check; generation is the enforced browser
account fence. Late responses
may overwrite a useful cookie and force sign-in, but cannot authenticate an old
account after its generation has changed. A fully seamless rotation protocol
would require additional provider guarantees or an approved atomic session store.

Sign-out invalidates this browser's generation. It does not promise provider-wide
revocation, revocation of a copied complete cookie set elsewhere, or cancellation
of an already-dispatched mutation. No upstream revocation API is used.

## Verification

The safe project/storage baseline passed 653 unit tests and 29 server tests.
Source, test and server typechecks passed. The final extended candidate passed 663 unit tests, 47 server tests, and 30
worker/build/hosting/native-script tests. Source, test and server typechecks
passed. Source formatting passed. Independent source review found no demonstrated
credential leak, cross-account bypass or deadline extension. The Vercel rewrite
for renewal is covered by the hosting allowlist test. Detailed commands and
remaining gates are in the accompanying verification report.

Standard check/build attempts hit cloud memory limits at ESLint or the Next
TypeScript child. A split Next compile/generate plus PWA export succeeded to
prepare synthetic browser assets, but is not reported as a standard build pass.
Fifteen browser cases cover reopen, PMON default, explicit switching, account
isolation, storage failure, expiry, opt-in, renewal and lost-response reload.
Additional cases route real encrypted Set-Cookie responses through the actual
auth handler to test late different-account responses, reversed concurrent
renewals, rejection of one cookie, and attempting/uncertain persisted queue
records with autosync off/on. These are discovered, not executed.
Browser execution is currently blocked before app execution: the pinned binary
is absent, its official download failed, and system Chromium's Unix socket is
not permitted by this cloud sandbox. No real YouTrack calls are used in tests.

References checked November 5, 2026:
- https://www.jetbrains.com/help/hub/authorization-code.html
- https://www.jetbrains.com/help/hub/refresh-token.html
