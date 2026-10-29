export const OAUTH_ORIGIN = "https://romdex.vercel.app";
export const OAUTH_CALLBACK = OAUTH_ORIGIN + "/oauth/callback/";
export const isOAuthOrigin = (origin: string) => {
  return origin === OAUTH_ORIGIN;
};
export const LEGACY_ORIGIN = "https://romdex-web.vercel.app";
export const allowedCallback = (callback: string) => {
  return (
    callback === OAUTH_CALLBACK ||
    callback === LEGACY_ORIGIN + "/oauth/callback/"
  );
};
