import { cookieGeneration } from "./cookie-client";
import { preserveRecoverySignIn } from "./recovery-mode";
/**
 * Posts a token sign-in once, then reloads so the normal cookie-session resume runs.
 * The server seals the session into an HttpOnly cookie; nothing is stored in the browser.
 */
export const postTokenLogin = async (
  route: string,
  body: Record<string, unknown>,
  refused: string,
) => {
  preserveRecoverySignIn();
  cookieGeneration().rotate();
  const response = await fetch(route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  if (response.status === 400 || response.status === 401) throw Error(refused);
  if (!response.ok)
    throw Error("Sign-in is unavailable here. Retry; local work is preserved.");
  window.location.assign("/");
};
export const startTokenLogin = (token: string, rememberDevice: boolean) => {
  return postTokenLogin(
    "/api/auth/token",
    { token, rememberDevice },
    "YouTrack did not accept that token. Check it and its YouTrack scope.",
  );
};
