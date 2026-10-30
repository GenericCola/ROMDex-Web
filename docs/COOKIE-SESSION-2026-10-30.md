# Cookie-session candidate — not deployed

The owner approved a server-side Secure/HttpOnly session implementation, then
specified no payment. The selected design uses encrypted short-lived access-token
cookies and the existing YouTrack PKCE/SSO flow, without a session database or
refresh-token/offline grant. This narrowly supersedes the older static-only/no
proxy architecture for authentication and authenticated YouTrack transport only.
YouTrack remains the application data authority. No other application backend,
shared account credential or expanded YouTrack permission is introduced.

This candidate starts from verified published94a588b5. Its archive base is
93f26678b6b12773106d64ef8a31dda151d1bae68c69f0e260d3e87caab9b775.
The held-v30 native-sync branch is not included. Existing ticket-scoped delivery,
750ms debounce, immutable journals, account/project keys and local drafts must
remain intact. Original source and all published backups remain separate.

Production encryption-key creation/configuration, exact callback registration,
any optional private upload staging resource, and final publication remain gated
on exact approval. No production secret, grant, datastore or auth-route change
has occurred. Provider-neutral code/tests are under development in the adjacent
romdex-server-session-proposal directory; they are not yet integrated here.

Access lifetime never exceeds YouTrack expiry. Existing upstream SSO may avoid
password entry after expiry, but this design does not promise indefinite login.
Credential cookies remain HttpOnly. A separate nonsecret browser flow-generation
fence prevents late callbacks from reactivating a cancelled or switched account;
it is not itself an authentication credential. User workspace data is not placed
in cookies or migrated destructively.
