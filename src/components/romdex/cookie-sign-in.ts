import { startCookieLogin } from "@/auth/cookie-client";
import { flushLocal } from "@/auth/flush-local";
import { errorText } from "@utils/error-text";
export const cookieSignIn = async (
  isCurrent: () => boolean,
  clearIdentity: () => void,
  setBusy: (value: boolean) => void,
  setMessage: (value: string) => void,
  rememberDevice = false,
) => {
  setBusy(true);
  setMessage("");
  try {
    await flushLocal();
    if (!isCurrent()) return;
    clearIdentity();
    await startCookieLogin(rememberDevice);
  } catch (error) {
    if (isCurrent()) setMessage(errorText(error, "Sign-in failed."));
  } finally {
    if (isCurrent()) setBusy(false);
  }
};
