import { EncryptJWT, jwtDecrypt } from "jose";
import { HttpFailure } from "./runtime-types.ts";
import { ORIGIN } from "./session-contract.ts";
export const SESSION = "__Host-romdex-access";
export const LOGIN = "__Host-romdex-pkce";
export const FENCE = "__Host-romdex-generation";
export const RENEWAL = "__Host-romdex-renewal";
export const REMEMBER_SECONDS = 30 * 86400;
export interface CookieEnvelope {
  kind: "session" | "login" | "renewal";
  fence: string;
  csrf: string;
  expiresAt: number;
  accessToken?: string;
  userId?: string;
  state?: string;
  verifier?: string;
  rememberDevice?: boolean;
  clientId?: string;
  refreshToken?: string;
  sessionId?: string;
  renewalId?: string;
  issuedAt?: number;
  accessExpiresAt?: number;
  scope?: string;
  renewUntil?: number;
}
export function readCookie(request: Request, name: string): string | null {
  const values = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((v) => v.trim())
    .filter((v) => v.startsWith(name + "="));
  if (values.length > 1) throw new HttpFailure(400);
  return values[0]?.slice(name.length + 1) ?? null;
}
export function setCookie(
  name: string,
  value: string,
  seconds: number,
): string {
  const result = `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(seconds))}`;
  if (Buffer.byteLength(result) > 3900) throw new HttpFailure(502);
  return result;
}
export async function sealCookie(
  value: CookieEnvelope,
  key: Uint8Array,
): Promise<string> {
  return new EncryptJWT({ ...value })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuer(ORIGIN)
    .setAudience("romdex:" + value.kind)
    .setExpirationTime(value.expiresAt)
    .encrypt(key);
}
export async function openCookie(
  value: string,
  kind: CookieEnvelope["kind"],
  key: Uint8Array,
  now: number,
): Promise<CookieEnvelope> {
  try {
    const { payload } = await jwtDecrypt(value, key, {
      issuer: ORIGIN,
      audience: "romdex:" + kind,
      currentDate: new Date(now * 1000),
      keyManagementAlgorithms: ["dir"],
      contentEncryptionAlgorithms: ["A256GCM"],
    });
    if (
      payload.kind !== kind ||
      typeof payload.fence !== "string" ||
      typeof payload.csrf !== "string" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt !== payload.exp ||
      payload.expiresAt <= now
    )
      throw new Error("invalid");
    if (
      kind === "session" &&
      (typeof payload.accessToken !== "string" ||
        !payload.accessToken ||
        typeof payload.userId !== "string" ||
        !payload.userId)
    )
      throw new Error("invalid");
    if (
      kind === "session" &&
      payload.renewUntil !== undefined &&
      (payload.rememberDevice !== true ||
        typeof payload.renewUntil !== "number" ||
        !Number.isSafeInteger(payload.renewUntil) ||
        typeof payload.issuedAt !== "number" ||
        !Number.isSafeInteger(payload.issuedAt) ||
        payload.renewUntil > payload.issuedAt + REMEMBER_SECONDS ||
        payload.expiresAt > payload.renewUntil)
    )
      throw new Error("invalid");
    if (
      kind === "login" &&
      ([payload.state, payload.verifier].some(
        (v) => typeof v !== "string" || !v,
      ) ||
        (payload.rememberDevice !== undefined &&
          typeof payload.rememberDevice !== "boolean"))
    )
      throw new Error("invalid");
    if (
      kind === "renewal" &&
      ([
        payload.refreshToken,
        payload.userId,
        payload.clientId,
        payload.scope,
      ].some((v) => typeof v !== "string" || !v) ||
        [
          payload.sessionId,
          payload.renewalId,
          payload.fence,
          payload.csrf,
        ].some(
          (v) => typeof v !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(v),
        ) ||
        typeof payload.issuedAt !== "number" ||
        !Number.isSafeInteger(payload.issuedAt) ||
        payload.issuedAt > now ||
        payload.expiresAt > payload.issuedAt + REMEMBER_SECONDS ||
        typeof payload.accessExpiresAt !== "number" ||
        !Number.isSafeInteger(payload.accessExpiresAt) ||
        payload.accessExpiresAt > payload.expiresAt ||
        payload.accessExpiresAt <= payload.issuedAt)
    )
      throw new Error("invalid");
    return payload as unknown as CookieEnvelope;
  } catch {
    throw new HttpFailure(401);
  }
}
