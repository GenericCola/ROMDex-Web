/** The only address whose OAuth callback is registered with YouTrack. */
export const OAUTH_ORIGIN = "https://romdex.vercel.app";
/** Sealed-cookie issuer label. Kept fixed so existing sessions survive origin changes. */
export const ISSUER = OAUTH_ORIGIN;
/** Production addresses served when ROMDEX_ORIGINS is unset (Vercel today). */
export const DEFAULT_ORIGINS = [OAUTH_ORIGIN, "https://romdex-web.vercel.app"];
/** Allowed browser origins, from a comma-separated ROMDEX_ORIGINS or the defaults. */
export function configuredOrigins(env: NodeJS.ProcessEnv = process.env) {
  const listed = (env.ROMDEX_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  for (const origin of listed)
    if (new URL(origin).origin !== origin)
      throw new Error("ROMDEX_ORIGINS entries must be bare origins");
  return listed.length ? listed : DEFAULT_ORIGINS;
}
