import { timingSafeEqual } from "node:crypto";
import {
  FENCE,
  LOGIN,
  openCookie,
  readCookie,
  SESSION,
  type CookieEnvelope,
} from "./cookie-codec.ts";
import { begin, callback } from "./cookie-login.ts";
import { renewalChallenge, renewSession } from "./cookie-renewal.ts";
import { response, sameOrigin, validIdentity } from "./runtime-http.ts";
import { HttpFailure, type OAuthPort } from "./runtime-types.ts";
import { ORIGIN } from "./session-contract.ts";
export interface CookieDependencies {
  key: Uint8Array;
  now(): number;
  entropy(): string;
  clientId: string;
  oauth: Pick<OAuthPort, "exchange" | "verify"> &
    Partial<Pick<OAuthPort, "refresh">>;
  maxSeconds: number;
}
export const COOKIE_CALLBACK = ORIGIN + "/api/auth/callback";
export function equal(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export async function bound(
  request: Request,
  name: string,
  kind: CookieEnvelope["kind"],
  deps: CookieDependencies,
) {
  const cookie = readCookie(request, name);
  if (!cookie) throw new HttpFailure(401);
  const value = await openCookie(cookie, kind, deps.key, deps.now());
  if (!equal(value.fence, readCookie(request, FENCE) ?? ""))
    throw new HttpFailure(401);
  if (value.clientId !== undefined && value.clientId !== deps.clientId)
    throw new HttpFailure(401);
  return value;
}
async function session(request: Request, deps: CookieDependencies) {
  if (request.headers.get("sec-fetch-site") !== "same-origin")
    throw new HttpFailure(403);
  let value: CookieEnvelope;
  try {
    value = await bound(request, SESSION, "session", deps);
  } catch (error) {
    if (error instanceof HttpFailure && error.status === 401)
      return renewalChallenge(request, deps);
    throw error;
  }
  const identity = await deps.oauth.verify(value.accessToken!);
  validIdentity(identity);
  if (
    identity.id !== value.userId ||
    deps.now() >= value.expiresAt ||
    request.signal.aborted
  )
    throw new HttpFailure(401);
  // No cookie writes on reads/errors: late responses cannot erase a newer login.
  return response(200, {
    userId: identity.id,
    projects: identity.projects,
    csrf: value.csrf,
    expiresAt: value.expiresAt,
    ...(value.rememberDevice === true
      ? {
          rememberDeviceRequested: true,
          remembered: value.renewUntil !== undefined,
          ...(value.renewUntil !== undefined
            ? { renewUntil: value.renewUntil }
            : {}),
        }
      : {}),
  });
}
async function logout(
  request: Request,
  deps: CookieDependencies,
  cancel: boolean,
) {
  sameOrigin(request);
  // Browser rotates its NONSECRET generation before dispatch. Never overwrite it
  // or emit late Set-Cookie clears that could erase a newer account session.
  const raw = readCookie(request, cancel ? LOGIN : SESSION);
  if (!raw) throw new HttpFailure(401);
  const value = await openCookie(
    raw,
    cancel ? "login" : "session",
    deps.key,
    deps.now(),
  );
  if (!equal(request.headers.get("x-romdex-csrf") ?? "", value.csrf))
    throw new HttpFailure(403);
  if (equal(value.fence, readCookie(request, FENCE) ?? ""))
    throw new HttpFailure(409);
  return response(200, { signedOut: true });
}
export function createCookieHandler(deps: CookieDependencies) {
  if (
    deps.key.byteLength !== 32 ||
    !deps.clientId ||
    !Number.isFinite(deps.maxSeconds) ||
    deps.maxSeconds <= 0 ||
    deps.maxSeconds > 86400
  )
    throw new Error("Invalid session configuration");
  return async function handle(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.origin !== ORIGIN) throw new HttpFailure(403);
      if (url.pathname === "/api/auth/start" && request.method === "POST")
        return await begin(request, deps);
      if (url.pathname === "/api/auth/callback" && request.method === "GET")
        return await callback(request, deps);
      if (url.pathname === "/api/auth/session" && request.method === "GET")
        return await session(request, deps);
      if (url.pathname === "/api/auth/renew" && request.method === "POST")
        return await renewSession(request, deps);
      if (url.pathname === "/api/auth/logout" && request.method === "POST")
        return await logout(request, deps, false);
      if (url.pathname === "/api/auth/cancel" && request.method === "POST")
        return await logout(request, deps, true);
      return response(405, { error: "Unsupported authentication action" });
    } catch (error) {
      return response(error instanceof HttpFailure ? error.status : 503, {
        error: "Authentication unavailable. Retry sign-in.",
      });
    }
  };
}
