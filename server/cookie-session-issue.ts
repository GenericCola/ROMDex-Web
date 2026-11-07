import {
  REMEMBER_SECONDS,
  RENEWAL,
  sealCookie,
  SESSION,
  setCookie,
  type CookieEnvelope,
} from "./cookie-codec.ts";
import type { CookieDependencies } from "./cookie-runtime.ts";
import { opaque, validTokens } from "./runtime-http.ts";
import { HttpFailure, type Tokens } from "./runtime-types.ts";

export async function issueSessionCookies(
  deps: CookieDependencies,
  tokens: Tokens,
  userId: string,
  fence: string,
  started: number,
  rememberDevice: boolean,
  previous?: CookieEnvelope,
) {
  validTokens(tokens);
  const deadline = previous?.expiresAt ?? started + REMEMBER_SECONDS;
  const expiresAt = Math.floor(
    Math.min(started + tokens.expiresIn, started + deps.maxSeconds, deadline),
  );
  if (deps.now() >= expiresAt || deps.now() >= deadline)
    throw new HttpFailure(401);
  const csrf = previous?.csrf ?? opaque(deps.entropy());
  const access: CookieEnvelope = {
    kind: "session",
    fence,
    csrf,
    expiresAt,
    accessToken: tokens.accessToken,
    userId,
    ...(rememberDevice ? { rememberDevice: true } : {}),
    ...(tokens.permanent ? { permanent: true } : {}),
  };
  const refreshToken = rememberDevice
    ? (tokens.refreshToken ?? previous?.refreshToken)
    : undefined;
  const cookies: string[] = [];
  if (refreshToken) {
    const sessionId = previous?.sessionId ?? opaque(deps.entropy());
    const issuedAt = previous?.issuedAt ?? started;
    const renewal: CookieEnvelope = {
      kind: "renewal",
      fence,
      csrf,
      expiresAt: deadline,
      userId,
      refreshToken,
      clientId: deps.clientId,
      sessionId,
      renewalId: opaque(deps.entropy()),
      issuedAt,
      accessExpiresAt: expiresAt,
      scope: previous?.scope ?? tokens.scope ?? "YouTrack",
    };
    access.clientId = deps.clientId;
    access.sessionId = sessionId;
    access.issuedAt = issuedAt;
    access.renewUntil = deadline;
    cookies.push(
      setCookie(
        RENEWAL,
        await sealCookie(renewal, deps.key),
        deadline - deps.now(),
      ),
    );
  }
  cookies.unshift(
    setCookie(
      SESSION,
      await sealCookie(access, deps.key),
      expiresAt - deps.now(),
    ),
  );
  // No partial response is sent if either cookie or the combined header exceeds its budget.
  if (
    cookies.reduce((size, cookie) => size + Buffer.byteLength(cookie), 0) > 7600
  )
    throw new HttpFailure(502);
  if (deps.now() >= expiresAt || deps.now() >= deadline)
    throw new HttpFailure(401);
  return cookies;
}
