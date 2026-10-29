# YouTrack sign-in

The canonical app remains GenericCola/ROMDex-Web, branch
`codex/accepted-app-port`, hosted at https://romdex.vercel.app.
No reconstructed Sites application or alternate IndexedDB schema is used here.

The owner approved public OAuth registration on October 29. YouTrack Cloud
2026.2.19728 now has the `ROMDex Web` client, public client ID `romdex-web`.
Authorization Code, required PKCE and required user consent are enabled.
Implicit and Client Credentials flows are disabled. No client secret, service
account, new role or offline refresh access was created. The exact registered
return address is https://romdex.vercel.app/oauth/callback/.

Sign-in opens YouTrack's own login/consent page. ROMDex does not collect a
password. Random state, S256 challenge and verifier bind the response to the
initiating browser window. Tokens and transaction secrets remain in memory.
Callback messages require the exact origin, initiating window and state.
Callbacks are scrubbed from the visible URL. Referrer headers are disabled.
Token exchange is direct to YouTrack; there is no proxy or application server.

The current identity and project list are fetched with that user's access token.
Only projects returned for that identity can be selected, and project issue reads
verify the native project ID. PMON retains its accepted editing and explicit
session-delivery implementation. Other projects currently offer a read-only
view: their custom field and status contracts have not been validated for edits.
Shared assigned status remains disabled because SC-001 is unresolved.

## Browser data

Workspaces use the existing database and schema, with an unambiguous key made
from instance origin, verified user ID and native project ID. Staged upload
bytes use the same scope. Switching flushes registered editors and durable local
writes before changing scope. Signing out hides the workspace and disconnects
delivery. A new login never adopts another account's queue.

The previous `workspace/current` record and unscoped upload bytes are retained
unchanged as legacy recovery. They are not automatically claimed by the first
person to sign in. Existing desktop/recovery import remains an explicit reviewed
operation. No current desktop export was supplied or imported during this work.
Saved data remains on the browser profile; sign-out is not a disk-encryption
boundary against someone who controls that profile or developer tools.

## Verification and remaining acceptance

Baseline before these changes: app TypeScript, lint, 165 tests and production
static build passed. The sandbox disallows the tsx CLI IPC socket, so identical
unit tests run with `TSX_TSCONFIG_PATH=tests/tsconfig.json node --import tsx --test`.
Current candidate: app TypeScript and zero-warning lint pass; 179 tests pass
(149 unit, 30 worker/build/hosting/YouTrack). Production static export passes,
worker shell `42d6f9f6dfd5eec469ac` with 80 assets. Independent review found and
closed stale connection and local-work-after-unmount races; expiry now exposes
recovery/retry while account switching remains blocked. These checks are not
live-account proof.
The exact canonical-origin token OPTIONS request returned an allowed origin,
POST method and content-type header. This is not a successful authorization.
Actual deployed callback, authenticated project read, logout/account isolation,
permission refusal and browser UI still require end-to-end verification.

Vercel Authentication currently protects All Deployments, including the canonical
URL, as the owner-approved interim barrier. Do not remove it before application
sign-in acceptance and the owner's approval. No production task writes were used
as tests. Actual Windows PWA installation and desktop cutover remain separate.

Official references:
- https://www.jetbrains.com/help/youtrack/devportal/OAuth-authorization-in-youtrack.html
- https://www.jetbrains.com/help/youtrack/cloud/oauth-clients.html
- https://www.jetbrains.com/help/hub/authorization-code.html

## Canonical address change

The owner requested `romdex.vercel.app` on October 29. It is attached to the
same Vercel project; the previous address remains available without an automatic
redirect. Other origins show a link to the canonical sign-in address rather than
opening a cross-origin callback flow. Existing browser data is not deleted or
automatically transferred between origins. Export and reviewed import are needed
for browser-local drafts. No current desktop export has been imported.

Latest local checks: 181 tests (151 unit and 30 supporting), TypeScript, lint and
static build pass. The corrected shell was visually checked in the protected
preview at 1188px and 500px; narrower device emulation was unavailable.
New-origin OAuth token preflight passes, but API authorization preflight does
not yet return an allowed origin. Live sign-in/data-read acceptance is pending.
