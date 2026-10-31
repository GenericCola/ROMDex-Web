const key = "romdex-recovery-paused";
export const recoveryMode = () => {
  if (typeof window === "undefined") return false;
  const requested =
    new URL(window.location.href).searchParams.get("recovery") === "1";
  try {
    if (requested) window.sessionStorage.setItem(key, "1");
    return requested || window.sessionStorage.getItem(key) === "1";
  } catch {
    return requested;
  }
};
export const preserveRecoverySignIn = () => {
  if (!recoveryMode()) return;
  try {
    window.sessionStorage.setItem(key, "1");
    if (window.sessionStorage.getItem(key) === "1") return;
  } catch {
    /* Stop before OAuth: recovery pause must survive its redirect. */
  }
  throw Error(
    "Recovery sign-in needs tab storage to preserve its delivery pause. Nothing was sent.",
  );
};
export const assertNotRecoveryMode = () => {
  if (recoveryMode())
    throw Error(
      "Recovery mode: delivery is disconnected. Navigation and recovery export are available; Save and Connect cannot send queued changes.",
    );
};

export const leaveRecoveryMode = () => {
  // Caller must persist the reviewed queue and Auto-Sync off before this step.
  // Remove the trigger before React renders again during navigation.
  window.history.replaceState(window.history.state, "", "/?recovery=complete");
  window.sessionStorage.removeItem(key);
  if (window.sessionStorage.getItem(key) !== null)
    throw Error(
      "Recovery pause could not be cleared. Stay in this tab and retry.",
    );
  window.location.replace("/?recovery=complete");
};
