import { readCookie, RENEWAL, SESSION } from "./cookie-codec.ts";
import { cookieInput } from "./cookie-input.ts";
import { bound, equal, type CookieDependencies } from "./cookie-runtime.ts";
import { issueSessionCookies } from "./cookie-session-issue.ts";
import {
  response,
  sameOrigin,
  validIdentity,
  validTokens,
} from "./runtime-http.ts";
import { HttpFailure } from "./runtime-types.ts";

export async function renewalChallenge(
  request: Request,
  deps: CookieDependencies,
) {
  const value = await bound(request, RENEWAL, "renewal", deps);
  if (
    !deps.oauth.refresh ||
    request.signal.aborted ||
    (readCookie(request, SESSION) && deps.now() < value.accessExpiresAt!)
  )
    throw new HttpFailure(401);
  // This is not an authenticated workspace. Reads never rotate or clear credentials.
  return response(401, {
    renewable: true,
    csrf: value.csrf,
    renewalId: value.renewalId,
    renewUntil: value.expiresAt,
  });
}

export async function renewSession(request: Request, deps: CookieDependencies) {
  sameOrigin(request);
  const value = await bound(request, RENEWAL, "renewal", deps);
  const input = await cookieInput(request);
  if (!equal(request.headers.get("x-romdex-csrf") ?? "", value.csrf))
    throw new HttpFailure(403);
  if (
    Object.keys(input).length !== 1 ||
    typeof input.renewalId !== "string" ||
    !equal(input.renewalId, value.renewalId!)
  )
    throw new HttpFailure(409);
  if (!deps.oauth.refresh || request.signal.aborted) throw new HttpFailure(401);
  const started = deps.now();
  // Exactly one upstream attempt. A lost rotation requires fresh sign-in, not replay.
  const tokens = await deps.oauth.refresh(value.refreshToken!);
  validTokens(tokens);
  if (tokens.scope !== undefined && tokens.scope !== value.scope)
    throw new HttpFailure(401);
  const identity = await deps.oauth.verify(tokens.accessToken);
  validIdentity(identity);
  if (
    identity.id !== value.userId ||
    request.signal.aborted ||
    deps.now() >= value.expiresAt
  )
    throw new HttpFailure(401);
  const cookies = await issueSessionCookies(
    deps,
    tokens,
    identity.id,
    value.fence,
    started,
    true,
    value,
  );
  if (request.signal.aborted) throw new HttpFailure(401);
  // shortcut: stateless races can lose availability, never restore an old browser generation.
  return response(200, { renewed: true }, cookies);
}
