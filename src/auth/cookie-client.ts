import { createGeneration } from "./cookie-generation";
import { parseRenewalChallenge, renewCookieSession } from "./cookie-renewal";
import {
  type CookieSession,
  parseCookieSession,
} from "./cookie-session-response";
import { preserveRecoverySignIn } from "./recovery-mode";
const prefix = "romdex-cookie:";
let csrf = "";
const random = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
};
export const cookieGeneration = () => {
  return createGeneration({
    readCookie: () => {
      return document.cookie;
    },
    writeCookie: (value) => {
      document.cookie = value;
    },
    random,
  });
};
export const isCookieHandle = (value: string) => {
  return value.startsWith(prefix);
};
export const assertCookieHandle = (value: string) => {
  if (!isCookieHandle(value)) throw Error("Server sign-in required.");
  cookieGeneration().assertCurrent(value.slice(prefix.length));
};
export const cookieSession = async (
  allowRenewal = true,
): Promise<CookieSession | null> => {
  const generation = cookieGeneration().current();
  if (!generation) return null;
  const response = await fetch("/api/auth/session", {
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  cookieGeneration().assertCurrent(generation);
  if (response.status === 401) {
    if (!allowRenewal) return null;
    const value: unknown = await response.json().catch(() => {
      return null;
    });
    cookieGeneration().assertCurrent(generation);
    const challenge = parseRenewalChallenge(value);
    if (!challenge) return null;
    await renewCookieSession(
      generation,
      challenge,
      async () => {
        return (await cookieSession(false)) !== null;
      },
      () => {
        return cookieGeneration().assertCurrent(generation);
      },
    );
    cookieGeneration().assertCurrent(generation);
    const renewed = await cookieSession(false);
    if (!renewed)
      throw Error(
        "Sign in again to renew this session. Local work is preserved.",
      );
    return renewed;
  }
  if (!response.ok)
    throw Error("Could not verify sign-in. Retry; local work is preserved.");
  const value: unknown = await response.json();
  cookieGeneration().assertCurrent(generation);
  const { csrf: nextCsrf, ...session } = parseCookieSession(value);
  csrf = nextCsrf;
  return { token: prefix + generation, ...session };
};
export const startCookieLogin = async (rememberDevice = false) => {
  preserveRecoverySignIn();
  const generation = cookieGeneration().rotate();
  const response = await fetch("/api/auth/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rememberDevice }),
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  cookieGeneration().assertCurrent(generation);
  if (!response.ok)
    throw Error("Sign-in could not start. Retry; local work is preserved.");
  const value = (await response.json()) as { authorizationUrl?: unknown };
  cookieGeneration().assertCurrent(generation);
  if (typeof value.authorizationUrl !== "string")
    throw Error("Invalid sign-in response.");
  const url = new URL(value.authorizationUrl);
  if (
    url.origin !== "https://thegobindsingh.youtrack.cloud" ||
    url.pathname !== "/hub/api/rest/oauth2/auth"
  )
    throw Error("Invalid sign-in destination.");
  window.location.assign(url.href);
};
export const endCookieLogin = async () => {
  const previousCsrf = csrf;
  cookieGeneration().rotate();
  csrf = "";
  // Rotation already invalidates the local session; a network failure cannot undo it.
  await fetch("/api/auth/logout", {
    method: "POST",
    headers: { "x-romdex-csrf": previousCsrf },
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  }).catch(() => {
    return undefined;
  });
};
export const cookieFetch = async (
  handle: string,
  route: string,
  init: RequestInit = {},
) => {
  assertCookieHandle(handle);
  const response = await fetch(route, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(30000),
    headers: { ...init.headers, "x-romdex-csrf": csrf },
  });
  assertCookieHandle(handle);
  return response;
};
