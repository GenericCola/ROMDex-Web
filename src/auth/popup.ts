import {
  beginOAuth,
  callbackCode,
  exchangeCode,
  OAUTH_CALLBACK,
} from "./oauth";
export const signInPopup = () => {
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
          event.origin !== new URL(OAUTH_CALLBACK).origin
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
      void beginOAuth("romdex-web").then(prepared, fail);
    },
  );
};
