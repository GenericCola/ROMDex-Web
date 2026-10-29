import { YOUTRACK_ORIGIN } from "@/youtrack/read-tasks";
export const OAUTH_ORIGIN = "https://romdex.vercel.app";
export const OAUTH_CALLBACK = OAUTH_ORIGIN + "/oauth/callback/";
export const isOAuthOrigin = (origin: string) => {
  return origin === OAUTH_ORIGIN;
};
const endpoint = YOUTRACK_ORIGIN + "/hub/api/rest/oauth2/";
export interface OAuthTransaction {
  clientId: string;
  state: string;
  verifier: string;
  expiresAt: number;
}
const base64url = (bytes: Uint8Array) => {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
};
export const codeChallenge = async (verifier: string) => {
  return base64url(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ),
  );
};
export const beginOAuth = async (clientId: string, now = Date.now()) => {
  if (!clientId?.trim() || clientId.trim() !== clientId)
    throw Error("YouTrack sign-in is not configured.");
  const transaction: OAuthTransaction = {
    clientId,
    state: base64url(crypto.getRandomValues(new Uint8Array(32))),
    verifier: base64url(crypto.getRandomValues(new Uint8Array(32))),
    expiresAt: now + 5 * 60 * 1000,
  };
  const query = new URLSearchParams([
    ["response_type", "code"],
    ["client_id", clientId],
    ["state", transaction.state],
    ["redirect_uri", OAUTH_CALLBACK],
    ["request_credentials", "default"],
    ["scope", "YouTrack"],
    ["access_type", "online"],
    ["code_challenge_method", "S256"],
    ["code_challenge", await codeChallenge(transaction.verifier)],
  ]);
  return { transaction, url: endpoint + "auth?" + query.toString() };
};
export const callbackCode = (
  href: string,
  transaction: OAuthTransaction,
  now = Date.now(),
) => {
  const url = new URL(href);
  if (
    url.origin + url.pathname !== OAUTH_CALLBACK ||
    url.hash ||
    now >= transaction.expiresAt ||
    url.searchParams.getAll("state").length !== 1 ||
    url.searchParams.get("state") !== transaction.state
  )
    throw Error("Sign-in could not be verified. Start again in ROMDex.");
  if (url.searchParams.has("error"))
    throw Error("YouTrack sign-in was not approved.");
  const code = url.searchParams.get("code");
  if (
    !code ||
    url.searchParams.getAll("code").length !== 1 ||
    code.length > 8192
  )
    throw Error("YouTrack returned an invalid sign-in response.");
  return code;
};
export const exchangeCode = async (
  transaction: OAuthTransaction,
  code: string,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
) => {
  if (now >= transaction.expiresAt)
    throw Error("Sign-in expired. Start again.");
  let response: Response;
  try {
    response = await fetcher(endpoint + "token", {
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(30000),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams([
        ["grant_type", "authorization_code"],
        ["client_id", transaction.clientId],
        ["code", code],
        ["redirect_uri", OAUTH_CALLBACK],
        ["code_verifier", transaction.verifier],
      ]),
    });
  } catch {
    throw Error(
      "YouTrack sign-in exchange failed. Check connection and OAuth CORS access, then start again.",
    );
  }
  if (!response.ok)
    throw Error(
      "YouTrack sign-in exchange failed (HTTP " +
        response.status +
        "). Start again.",
    );
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw Error("Invalid sign-in response.");
  }
  if (!raw || typeof raw !== "object") throw Error("Invalid sign-in response.");
  const value = raw as Record<string, unknown>;
  if (
    typeof value.access_token !== "string" ||
    !value.access_token ||
    typeof value.token_type !== "string" ||
    value.token_type.toLowerCase() !== "bearer" ||
    typeof value.expires_in !== "number" ||
    !Number.isFinite(value.expires_in) ||
    value.expires_in <= 0
  )
    throw Error("Invalid sign-in response.");
  return {
    token: value.access_token,
    expiresAt: now + value.expires_in * 1000,
  };
};
