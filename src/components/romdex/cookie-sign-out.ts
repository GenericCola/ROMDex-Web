import { endCookieLogin } from "@/auth/cookie-client";
import { forgetSession } from "@/auth/tab-session";
import { errorText } from "@utils/error-text";
export const cookieSignOut = async (
  closeProject: () => Promise<void>,
  clearIdentity: () => void,
  setBusy: (value: boolean) => void,
  setMessage: (value: string) => void,
) => {
  setBusy(true);
  try {
    await closeProject();
    clearIdentity();
    await endCookieLogin();
    try {
      forgetSession();
    } catch {
      // Cookie generation already invalidates the signed-out account.
    }
  } catch (error) {
    setMessage(errorText(error, "Save local work first."));
  } finally {
    setBusy(false);
  }
};
