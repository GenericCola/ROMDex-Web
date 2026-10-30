import { EncryptJWT, jwtDecrypt } from "jose";
import { HttpFailure } from "./runtime-types.ts";
import { ORIGIN } from "./session-contract.ts";
export const SESSION = "__Host-romdex-access";
export const LOGIN = "__Host-romdex-pkce";
export const FENCE = "__Host-romdex-generation";
export interface CookieEnvelope {
  kind: "session" | "login";
  fence: string;
  csrf: string;
  expiresAt: number;
  accessToken?: string;
  userId?: string;
  state?: string;
  verifier?: string;
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
      kind === "login" &&
      [payload.state, payload.verifier].some((v) => typeof v !== "string" || !v)
    )
      throw new Error("invalid");
    return payload as unknown as CookieEnvelope;
  } catch {
    throw new HttpFailure(401);
  }
}
