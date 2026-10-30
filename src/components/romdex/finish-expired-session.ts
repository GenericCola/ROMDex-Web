import { flushLocal } from "@/auth/flush-local";
export const finishExpiredSession = async (
  setBusy: (value: boolean) => void,
  setRecoveryBlocked: (value: boolean) => void,
  setMessage: (value: string) => void,
  clearView: () => void,
) => {
  setBusy(true);
  try {
    await flushLocal();
    setRecoveryBlocked(false);
    clearView();
    setMessage("Session expired. Sign in again; local work is preserved.");
  } catch {
    setRecoveryBlocked(true);
    setMessage(
      "Export recovery or retry saving. Account switching stays blocked.",
    );
  } finally {
    setBusy(false);
  }
};
