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
