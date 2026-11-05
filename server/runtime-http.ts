import { HttpFailure } from "./runtime-types.ts";
import { ORIGIN } from "./session-contract.ts";
export const CALLBACK = ORIGIN + "/api/auth/callback";
export const TRANSACTION = "__Host-romdex-login";
export const cookieValue = (request: Request, name: string) => {
  const values = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((x) => x.trim())
    .filter((x) => x.startsWith(name + "="));
  if (!values.length) return null;
  if (values.length !== 1) throw new HttpFailure(400);
  const value = values[0]!.slice(name.length + 1);
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) throw new HttpFailure(400);
  return value;
};
export const transactionCookie = (value: string, seconds: number) =>
  `${TRANSACTION}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`;
export const response = (
  status: number,
  body: unknown,
  cookies: string[] = [],
) => {
  const headers = new Headers({
    "Cache-Control": "no-store",
    Pragma: "no-cache",
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers,
  });
};
export const redirect = (url: string, cookies: string[]) => {
  const result = response(303, null, cookies);
  result.headers.set("Location", url);
  return result;
};
export const sameOrigin = (request: Request) => {
  if (
    request.headers.get("origin") !== ORIGIN ||
    request.headers.get("sec-fetch-site") !== "same-origin"
  )
    throw new HttpFailure(403);
};
export const opaque = (value: string) => {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) throw new HttpFailure(503);
  return value;
};
export const validTokens = (value: import("./runtime-types.ts").Tokens) => {
  if (
    typeof value.accessToken !== "string" ||
    !value.accessToken ||
    /[\r\n\0]/.test(value.accessToken) ||
    !Number.isFinite(value.expiresIn) ||
    value.expiresIn <= 0 ||
    (value.refreshToken !== undefined &&
      (typeof value.refreshToken !== "string" ||
        value.refreshToken === "" ||
        /[\r\n\0]/.test(value.refreshToken))) ||
    (value.scope !== undefined &&
      (typeof value.scope !== "string" ||
        !value.scope ||
        value.scope.length > 2048 ||
        /[^\x20-\x7E]/.test(value.scope)))
  )
    throw new HttpFailure(502);
};
export const validIdentity = (value: import("./runtime-types.ts").Identity) => {
  if (
    typeof value.id !== "string" ||
    !value.id ||
    value.guest !== false ||
    !Array.isArray(value.projects) ||
    value.projects.some((p) =>
      [p.id, p.name, p.shortName].some((v) => typeof v !== "string" || !v),
    ) ||
    new Set(value.projects.map((p) => p.id)).size !== value.projects.length
  )
    throw new HttpFailure(401);
};
