# Cookie-session server candidate — October 30, 2026

This implements the owner's selected stateless encrypted-cookie architecture. It
supersedes historical static-only/no-proxy constraints for these narrow routes,
not authorization to mutate real tasks as tests, deploy, purchase services, or
change the OAuth registration. No database, refresh token, offline grant, new
service, billing change or shared-status SC001 endpoint is introduced.

## Runtime and deployment boundary

- `api/index.ts` is the Vercel Node Web `fetch` entry point. `server/` holds the
  implementation; the existing Next static export remains `out/`.
- `/api/:path*` rewrites to that function. Global trailing-slash redirects are
  removed so `/api/auth/callback` remains the exact registered callback.
- Canonical origin: `https://romdex.vercel.app`. Callback:
  `https://romdex.vercel.app/api/auth/callback`. Other hosts fail closed.
- `ROMDEX_SESSION_KEY` must be a server-only canonical base64url encoding of 32
  random bytes. Missing/invalid configuration returns sanitized 503; no key is
  generated, saved, displayed or configured by this patch.
- Existing public client ID defaults to `romdex-web`; optional server variable
  `ROMDEX_OAUTH_CLIENT_ID` overrides it. Neither requires a client secret.
- Cookie encryption uses pinned `jose` 6.2.14, `dir`/`A256GCM`, fixed issuer and
  purpose-bound audience. Access and PKCE cookies are Secure, HttpOnly, host-only,
  Path=/ and SameSite=Lax. Access expires at the earlier of provider expiry and
  one hour, anchored before exchange. Refresh tokens are discarded.

## Browser/API contract

- POST `/api/auth/start`: same-origin fetch and Origin required; browser first
  rotates its nonsecret generation cookie. Returns top-level authorization URL.
- GET `/api/auth/callback`: verifies encrypted PKCE transaction/state and generation;
  exchanges code with S256 verifier, verifies non-guest identity/projects, sets
  encrypted access cookie, redirects to `/`.
- GET `/api/auth/session`: freshly verifies identity/projects; returns only
  `userId`, `projects`, `csrf`, and `expiresAt` (seconds).
- POST `/api/auth/logout` and `/api/auth/cancel`: require Origin and CSRF. Browser
  rotates generation before request. No late cookie-clear response can overwrite
  newer login cookies. Reads/errors never set session cookies.
- `/api/youtrack?route=<relative route>` allows only enumerated JSON routes and
  methods. Writes require CSRF, fresh account/project verification and PMON issue
  binding. Creates must use the verified PMON project; project moves and unknown
  root fields are rejected. Custom fields match fresh schema; hierarchy targets
  are independently PMON-bound. Admin/NPCD/SC001 writes are absent.
- Multipart POST to a PMON attachment route validates exactly one `upload` file,
  at most 4,000,000 file bytes and 4,100,000 complete request bytes, before upstream
  dispatch. Extra form fields are rejected. Larger new uploads stay local; the
  frontend must preserve queued bytes and decline before journaling a send.
- GET `/api/attachment?issue=PMON-N&id=ID&size=N` re-reads attachment metadata with
  the user's access, validates issue/project, ID and expected size, then streams
  only an exact same-origin YouTrack `/api/files/` URL from that metadata. Client
  URLs, redirects, credentials, unapproved paths and size drift are rejected.
  Existing downloads remain bounded at 50 MiB with cancellation/expiry checks.
- All API responses are no-store. No upstream errors, headers, Set-Cookie or
  authorization tokens are forwarded. Mutations are never automatically retried.

## Verification and limits

Run `pnpm typecheck:server`, `pnpm test:server`, and
`node --test tests/hosting.test.mjs`. `pnpm check` includes the server checks.
The integrated server suite includes actual localhost HTTP transport through the
same Web handler with synthetic OAuth/upstream adapters, alongside encryption,
expiry, logout/account reorder, CSRF, route, schema/project, upload and download
checks. It never contacts real YouTrack or writes real tasks.

The candidate has not itself been deployed or exercised against production OAuth.
Vercel function packaging, real callback registration, hosted cookie acceptance,
streaming of a real large attachment, and actual non-owner PMON permissions remain
hosted acceptance gates. The parent owns publication and setup approval.

Stateless logout invalidates this browser's generation, not a copied complete
cookie set elsewhere; provider revocation/expiry still applies. Already-dispatched
mutations cannot be undone by logout. A late stale callback can make its own cookie
unusable but cannot authenticate as the newer generation. No claim is made to solve
the separate upstream shared-status atomic concurrency gate.

Implementation references checked October 30:
https://vercel.com/docs/functions/runtimes/node-js
https://vercel.com/docs/functions/limitations
