// Sign-in with a YouTrack permanent token, on any configured origin.
// The token is read once from the request body, checked against YouTrack and sealed into the
// HttpOnly session cookie. It is never logged, returned or kept anywhere else.
import { FENCE, readCookie, REMEMBER_SECONDS } from "./cookie-codec.ts";
import { cookieInput } from "./cookie-input.ts";
import type { CookieDependencies } from "./cookie-runtime.ts";
import { issueSessionCookies } from "./cookie-session-issue.ts";
import { opaque, response, sameOrigin, validIdentity } from "./runtime-http.ts";
import { HttpFailure } from "./runtime-types.ts";
export const TOKEN_ROUTE = "/api/auth/token";
/** Session length without "Keep me signed in"; with it, REMEMBER_SECONDS (30 days). */
export const TOKEN_SESSION_SECONDS = 12 * 3600;
const MAX_TOKEN_LENGTH = 512;
/** Verifies `token` with YouTrack and returns the session cookies. Caller checked the origin. */
export async function tokenSession(
  request: Request,
  deps: CookieDependencies,
  token: string,
  rememberDevice: boolean,
) {
  if (!token || token.length > MAX_TOKEN_LENGTH || /[^\x21-\x7E]/.test(token))
    throw new HttpFailure(400);
  const fence = opaque(readCookie(request, FENCE) ?? "");
  const started = deps.now();
  const identity = await deps.oauth.verify(token).catch(function refuseToken() {
    throw new HttpFailure(401);
  });
  validIdentity(identity);
  if (request.signal.aborted) throw new HttpFailure(401);
  const seconds = rememberDevice ? REMEMBER_SECONDS : TOKEN_SESSION_SECONDS;
  return issueSessionCookies(
    { ...deps, maxSeconds: seconds },
    { accessToken: token, expiresIn: seconds, permanent: true },
    identity.id,
    fence,
    started,
    false,
  );
}
export async function pastedTokenLogin(
  request: Request,
  deps: CookieDependencies,
) {
  sameOrigin(request);
  const input = await cookieInput(request, 1024);
  if (
    Object.keys(input).some(
      (key) => key !== "token" && key !== "rememberDevice",
    ) ||
    typeof input.token !== "string" ||
    (input.rememberDevice !== undefined &&
      typeof input.rememberDevice !== "boolean")
  )
    throw new HttpFailure(400);
  const cookies = await tokenSession(
    request,
    deps,
    input.token.trim(),
    input.rememberDevice === true,
  );
  return response(200, { signedIn: true }, cookies);
}
