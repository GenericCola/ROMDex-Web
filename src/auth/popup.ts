import {
  beginOAuth,
  callbackCode,
  exchangeCode,
  isOAuthOrigin,
  LEGACY_ORIGIN,
  OAUTH_CALLBACK,
} from "./oauth";
export const signInPopup = (migration = false) => {
  const legacy =
    migration &&
    window.location.origin === LEGACY_ORIGIN &&
    window.location.pathname === "/origin-migration/";
  const callback = legacy ? LEGACY_ORIGIN + "/oauth/callback/" : OAUTH_CALLBACK;
  if (!isOAuthOrigin(window.location.origin) && !legacy)
    return Promise.reject(
      Error(
        "Open https://romdex.vercel.app to sign in. Local data here is unchanged.",
      ),
    );
  const popup = window.open(
    "about:blank",
    "romdex-youtrack-sign-in",
    "popup,width=600,height=750",
  );
  if (!popup)
    return Promise.reject(
      Error("Allow the YouTrack sign-in popup, then try again."),
    );
  return new Promise<Awaited<ReturnType<typeof exchangeCode>>>(
    (resolve, reject) => {
      let finished = false;
      let transaction:
        Awaited<ReturnType<typeof beginOAuth>>["transaction"] | undefined;
      const cleanup = () => {
        window.removeEventListener("message", receive);
        window.clearInterval(timer);
        popup.close();
      };
      const fail = (error: unknown) => {
        if (finished) return;
        finished = true;
        cleanup();
        reject(error instanceof Error ? error : Error("Sign-in failed."));
      };
      const receive = (event: MessageEvent<unknown>) => {
        if (
          finished ||
          !transaction ||
          event.source !== popup ||
          event.origin !== new URL(callback).origin
        )
          return;
        const { data } = event;
        if (
          !data ||
          typeof data !== "object" ||
          !("type" in data) ||
          data.type !== "romdex-oauth" ||
          !("url" in data) ||
          typeof data.url !== "string"
        )
          return;
        try {
          const code = callbackCode(data.url, transaction);
          finished = true;
          cleanup();
          void exchangeCode(transaction, code).then(resolve, reject);
        } catch (error) {
          fail(error);
        }
      };
      const checkClosed = () => {
        if (
          popup.closed ||
          (transaction && Date.now() >= transaction.expiresAt)
        )
          fail(Error("Sign-in was closed or expired. Start again."));
      };
      const timer = window.setInterval(checkClosed, 500);
      window.addEventListener("message", receive);
      const prepared = (result: Awaited<ReturnType<typeof beginOAuth>>) => {
        if (finished) return;
        ({ transaction } = result);
        popup.location.href = result.url;
      };
      void beginOAuth("romdex-web", Date.now(), callback).then(prepared, fail);
    },
  );
};
