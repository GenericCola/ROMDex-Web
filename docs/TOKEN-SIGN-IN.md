# Signing in with a permanent token

ROMDex has two ways to sign in, the same two Track Suru offers:

- **Sign in with YouTrack (OAuth).** Shown only at https://romdex.vercel.app, because that is
  the only address whose callback is registered with YouTrack. Every other address shows a
  link to it instead.
- **Sign in with a permanent token.** Shown on every address. Create the token in YouTrack
  under your avatar, Profile, Account Security, Tokens, with the YouTrack scope, and paste it
  into the password field.

## How the token is handled

The browser posts the token once to `POST /api/auth/token` (same-origin JSON, the usual
Origin and Fetch Metadata checks, body capped at 1 KB). The server checks it against YouTrack
(`users/me` and the project list, the same identity check OAuth uses) and issues the normal
sealed `__Host-romdex-access` cookie: encrypted, HttpOnly, Secure, SameSite=Lax. The token
sits inside that cookie and nowhere else. It is never returned in a response, written to a
log, or put in localStorage, sessionStorage or IndexedDB. A refused token gets the same
generic 401 as any other sign-in failure.

A permanent token has no refresh flow, so the session simply lasts:

- 12 hours, or
- 30 days when "Keep me signed in on this device" is ticked.

Every API call still re-checks the token with YouTrack, so revoking it in YouTrack ends the
session at once. Sign out clears the token cookie (OAuth sign-out does not clear cookies; it
only rotates the generation fence). The token keeps the account's full permissions until it
is revoked, so sign out and revoke it when you are done with a device.

## Allowed origins

The server answers only the origins in `ROMDEX_ORIGINS`, a comma-separated list of bare
origins. Unset, it is `https://romdex.vercel.app,https://romdex-web.vercel.app`, so Vercel
needs no new setting. OAuth start and callback stay tied to romdex.vercel.app whatever the
list says. The sealed-cookie issuer label is fixed, so existing sessions keep working.

## Development: the developer token

`pnpm dev` runs `scripts/dev.mjs`, which starts two processes:

- `server/dev-api.ts` on 127.0.0.1:3002 (`ROMDEX_DEV_API_PORT` changes it). It loads `.env`,
  serves the production handler for http://localhost:3000 and https://nextjsdev.letmecome.in
  (plus `DEV_SERVER_ORIGIN` if set), and uses a fresh random session key unless
  `ROMDEX_SESSION_KEY` is set. Restarting it signs dev browsers out.
- `next dev --port 3000`, which forwards `/api/*` to it. That rewrite and
  `skipTrailingSlashRedirect` exist only in the development phase of `next.config.js`; the
  static export is unchanged.

The dev sign-in screen adds "Sign in with the developer token". One click signs you in as
the account behind `YOUTRACK_TOKEN` in `.env`. There is no code and no lockout.

Anyone who opens the dev URL, including the public https://nextjsdev.letmecome.in, while
`pnpm dev` runs is signed in as the token's owner. The owner accepted this (PMON-622, Q11).
Stop `pnpm dev` when you do not want that. The route keeps its Origin and Fetch Metadata
checks. Pasting a token also works in dev.

None of this reaches production. `/api/auth/dev-token` lives in `server/dev-token.ts`, which
only `server/dev-application.ts` imports; `api/index.ts` never loads either, and the
production handler answers that path with 405. The button is rendered only when `NODE_ENV`
is `development`, so the static build contains neither the button text nor the route.
