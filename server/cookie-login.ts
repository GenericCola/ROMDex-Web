import { createHash } from "node:crypto";
import {
  FENCE,
  LOGIN,
  readCookie,
  sealCookie,
  SESSION,
  setCookie,
  type CookieEnvelope,
} from "./cookie-codec.ts";
import {
  bound,
  COOKIE_CALLBACK,
  equal,
  type CookieDependencies,
} from "./cookie-runtime.ts";
import {
  opaque,
  redirect,
  response,
  sameOrigin,
  validIdentity,
  validTokens,
} from "./runtime-http.ts";
import { HttpFailure } from "./runtime-types.ts";
import { ORIGIN } from "./session-contract.ts";
export async function begin(request: Request, deps: CookieDependencies) {
  sameOrigin(request);
  const fence = opaque(readCookie(request, FENCE) ?? "");
  const state = opaque(deps.entropy());
  const verifier = opaque(deps.entropy());
  const csrf = opaque(deps.entropy());
  const value: CookieEnvelope = {
    kind: "login",
    fence,
    state,
    verifier,
    csrf,
    expiresAt: deps.now() + 300,
  };
  const url = new URL(
    "https://thegobindsingh.youtrack.cloud/hub/api/rest/oauth2/auth",
  );
  url.search = new URLSearchParams({
    client_id: deps.clientId,
    response_type: "code",
    redirect_uri: COOKIE_CALLBACK,
    scope: "YouTrack",
    access_type: "online",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  const cookies = [setCookie(LOGIN, await sealCookie(value, deps.key), 300)];
  return response(200, { authorizationUrl: url.href, csrf }, cookies);
}
export async function callback(request: Request, deps: CookieDependencies) {
  const login = await bound(request, LOGIN, "login", deps);
  const query = new URL(request.url).searchParams;
  if (
    query.getAll("state").length !== 1 ||
    !equal(query.get("state") ?? "", login.state!) ||
    query.has("error") ||
    query.getAll("code").length !== 1 ||
    !query.get("code")
  )
    throw new HttpFailure(400);
  // Start time deliberately underestimates TTL: identity/network delay cannot extend it.
  const started = deps.now();
  const tokens = await deps.oauth.exchange(
    query.get("code")!,
    login.verifier!,
    COOKIE_CALLBACK,
  );
  validTokens(tokens);
  const expiresAt = Math.floor(
    started + Math.min(tokens.expiresIn, deps.maxSeconds),
  );
  const identity = await deps.oauth.verify(tokens.accessToken);
  validIdentity(identity);
  if (
    request.signal.aborted ||
    deps.now() >= expiresAt ||
    deps.now() >= login.expiresAt
  )
    throw new HttpFailure(401);
  const value: CookieEnvelope = {
    kind: "session",
    fence: login.fence,
    csrf: opaque(deps.entropy()),
    expiresAt,
    accessToken: tokens.accessToken,
    userId: identity.id,
  };
  // No refresh token is retained. Callback NEVER writes the logout fence.
  const cookie = await sealCookie(value, deps.key);
  if (request.signal.aborted || deps.now() >= expiresAt)
    throw new HttpFailure(401);
  // Query bypasses older service-worker shells after OAuth; never put credentials here.
  return redirect(ORIGIN + "/?auth=complete", [
    setCookie(SESSION, cookie, expiresAt - deps.now()),
    setCookie(LOGIN, "", 0),
  ]);
}
