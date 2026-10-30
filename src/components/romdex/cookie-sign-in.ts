import { startCookieLogin } from "@/auth/cookie-client";
import { flushLocal } from "@/auth/flush-local";
export const cookieSignIn = async (
  isCurrent: () => boolean,
  clearIdentity: () => void,
  setBusy: (value: boolean) => void,
  setMessage: (value: string) => void,
) => {
  setBusy(true);
  setMessage("");
  try {
    await flushLocal();
    if (!isCurrent()) return;
    clearIdentity();
    await startCookieLogin();
  } catch (error) {
    if (isCurrent())
      setMessage(error instanceof Error ? error.message : "Sign-in failed.");
  } finally {
    if (isCurrent()) setBusy(false);
  }
};
