export interface RenewalChallenge {
  csrf: string;
  renewalId: string;
  renewUntil: number;
}
const markerPrefix = "romdex-renew-attempt-v1:";
const unavailable = () => {
  return Error("Sign in again to renew this session. Local work is preserved.");
};
export const renewCookieSession = async (
  generation: string,
  challenge: RenewalChallenge,
  reread: () => Promise<boolean>,
  check: () => void,
) => {
  if (!navigator.locks) throw unavailable();
  return navigator.locks.request("romdex-cookie-renewal", async () => {
    check();
    if (await reread()) return;
    check();
    const key = markerPrefix + generation + ":" + challenge.renewalId;
    try {
      if (
        !Number.isSafeInteger(challenge.renewUntil) ||
        challenge.renewUntil <= Date.now() / 1000 ||
        localStorage.getItem(key)
      )
        throw unavailable();
      for (let index = localStorage.length - 1; index >= 0; index--) {
        const previousKey = localStorage.key(index);
        if (!previousKey?.startsWith(markerPrefix) || previousKey === key)
          continue;
        const value = localStorage.getItem(previousKey);
        const deadline = value && /^\d+$/.test(value) ? Number(value) : NaN;
        if (
          Number.isSafeInteger(deadline) &&
          deadline > 0 &&
          deadline <= Date.now() / 1000
        )
          localStorage.removeItem(previousKey);
      }
      const marker = String(challenge.renewUntil);
      localStorage.setItem(key, marker);
      if (localStorage.getItem(key) !== marker) throw unavailable();
    } catch {
      throw unavailable();
    }
    check();
    // Retain the marker through the fixed grant deadline: a lost reply may have rotated the token.
    const response = await fetch("/api/auth/renew", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        "x-romdex-csrf": challenge.csrf,
      },
      body: JSON.stringify({ renewalId: challenge.renewalId }),
      signal: AbortSignal.timeout(30000),
    }).catch(() => {
      throw unavailable();
    });
    check();
    if (!response.ok) throw unavailable();
  });
};
