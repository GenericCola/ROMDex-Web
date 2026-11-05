// Nonsecret browser lifecycle fence; NEVER contains an access/refresh token.
// Application must rotate before start/account-switch/cancel/logout, clear visible
// identity immediately, and check captured generation after EVERY awaited read.
export const GENERATION_COOKIE = "__Host-romdex-generation";
export class AuthenticationChanged extends Error {}
const FENCE = GENERATION_COOKIE;
export interface GenerationPort {
  readCookie(): string;
  writeCookie(value: string): void;
  random(): string;
}
export const createGeneration = (port: GenerationPort) => {
  const current = (): string | null => {
    const values = port
      .readCookie()
      .split(";")
      .map((v) => {
        return v.trim();
      })
      .filter((v) => {
        return v.startsWith(FENCE + "=");
      });
    if (values.length !== 1) return null;
    const value = values[0]!.slice(FENCE.length + 1);
    return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
  };
  const rotate = (): string => {
    const value = port.random();
    if (!/^[A-Za-z0-9_-]{43}$/.test(value) || value === current())
      throw new Error("Generation unavailable");
    // Lax, not Strict: YouTrack top-level OAuth callback must include this cookie.
    port.writeCookie(
      `${FENCE}=${value}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`,
    );
    if (current() !== value) throw new Error("Browser cookies unavailable");
    return value;
  };
  const assertCurrent = (captured: string): void => {
    if (current() !== captured)
      throw new AuthenticationChanged("Authentication changed");
  };
  return { current, rotate, assertCurrent };
};
