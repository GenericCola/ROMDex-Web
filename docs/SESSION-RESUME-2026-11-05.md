# Session resume candidate, November 5

This change was developed and verified in an isolated cloud workspace and the
existing Vercel preview workflow. No live grant, credential, account setting or
YouTrack data was changed during development. Release evidence is recorded below.

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
Creating a real persistent grant requires the user to select this option and
complete the provider sign-in. The assistant does not create a grant for them.
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
previously enabled autosync for ordinary eligible unsent operations. A delivery
record marked ready after review still requires the existing manual consent. Existing delivery guards
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

The normal production build passes in the existing Vercel preview environment,
including lint, TypeScript, Turbopack compilation and the 87-asset PWA export.
The full aggregate check passes: 671 unit tests, 47 server tests and 30
worker/build/hosting/native-script tests, plus source, test and server typechecks.
No lint, security, package-version or hosting checks were weakened.

Independent security review approved the final runtime. All 509 runtime/server/
API/configuration Git blobs matched the reviewed local source and published
candidate. The renewal rewrite is included in the hosting allowlist test.

Actual Chromium desktop/mobile runs pass all 32 targeted session cases. Firefox
passes 15, with one intentional Chromium-only browser-restart skip. They
include a real browser-process close/restart with persisted encrypted cookies,
automatic PMON selection, account isolation, optional storage failure, explicit
opt-in, fixed expiry, lost-response no-replay, late different-account response,
reverse renewal responses, and one-cookie rejection. With autosync off and on,
attempting and uncertain work survives renewal and reload without replay, while
an ordinary independent eligible edit sends once only when autosync was already
enabled. Review-ready work is not treated as an ordinary automatic edit.

The cookie tests use the actual server handler, encrypted Set-Cookie responses
and browser cookie storage with synthetic OAuth. Playwright omits Fetch Metadata
in intercepted requests, so the test adapter verifies the frame origin and real
POST Origin, and fills only an absent Sec-Fetch-Site header. Production metadata
checks are unchanged and separately server-tested. No actual YouTrack requests,
OAuth grants, production queues or user computer are used in this acceptance run.

The QA-only runner uses an environment allowlist for child build/test processes,
restores normal configuration before checks, and is never a release candidate.
The Vercel platform still manages its install/runtime environment. No new paid
service, sandbox, billing change or security setting was introduced. Earlier
local build/browser restrictions were resolved through the existing preview
workflow rather than by weakening checks.

The complete historical browser suite and live provider/device acceptance are
not claimed by this targeted verification. Older fixtures still assume removed
permanent-token controls. Safari/iPhone execution is not covered here.

References checked November 5, 2026:

- https://www.jetbrains.com/help/hub/authorization-code.html
- https://www.jetbrains.com/help/hub/refresh-token.html
