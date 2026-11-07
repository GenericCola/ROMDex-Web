// DEVELOPMENT ONLY. Reached through dev-application.ts; production never imports this module.
import { type CookieDependencies } from "./cookie-runtime.ts";
import { response, sameOrigin } from "./runtime-http.ts";
import { HttpFailure } from "./runtime-types.ts";
import { tokenSession } from "./token-login.ts";
export const DEV_TOKEN_ROUTE = "/api/auth/dev-token";
export interface DevTokenDependencies extends CookieDependencies {
  /** Permanent YouTrack token from .env. Sealed into the HttpOnly session cookie only. */
  token: string;
}
/**
 * Signs in with the .env token on one POST. No code: whoever reaches the dev URL while
 * `pnpm dev` runs is signed in as the token's owner (owner decision Q11, PMON-622).
 */
export function createDevTokenLogin(deps: DevTokenDependencies) {
  return async function devTokenLogin(request: Request): Promise<Response> {
    try {
      if (request.method !== "POST") throw new HttpFailure(405);
      sameOrigin(request);
      if (!deps.token) throw new HttpFailure(503);
      const cookies = await tokenSession(request, deps, deps.token, false);
      return response(200, { signedIn: true }, cookies);
    } catch (error) {
      return response(error instanceof HttpFailure ? error.status : 503, {
        error: "Developer sign-in failed. Is YOUTRACK_TOKEN set in .env?",
      });
    }
  };
}
