// DEVELOPMENT ONLY. Reached through dev-application.ts; production never imports this module.
import { cookieInput } from "./cookie-input.ts";
import { equal, type CookieDependencies } from "./cookie-runtime.ts";
import { response, sameOrigin } from "./runtime-http.ts";
import { HttpFailure } from "./runtime-types.ts";
import { tokenSession } from "./token-login.ts";
export const DEV_TOKEN_ROUTE = "/api/auth/dev-token";
const MAX_ATTEMPTS = 10;
export interface DevTokenDependencies extends CookieDependencies {
  /** Permanent YouTrack token from .env. Sealed into the HttpOnly session cookie only. */
  token: string;
  /** Per-process sign-in code printed in the `pnpm dev` terminal. */
  code: string;
}
/**
 * Signs in with the .env token once the caller shows it can read the dev terminal.
 * The dev host is public, so the code and the attempt limit keep strangers out.
 */
export function createDevTokenLogin(deps: DevTokenDependencies) {
  let failures = 0;
  return async function devTokenLogin(request: Request): Promise<Response> {
    try {
      if (request.method !== "POST") throw new HttpFailure(405);
      sameOrigin(request);
      if (!deps.token || !deps.code || failures >= MAX_ATTEMPTS)
        throw new HttpFailure(503);
      const input = await cookieInput(request);
      if (
        Object.keys(input).some((key) => key !== "code") ||
        typeof input.code !== "string"
      )
        throw new HttpFailure(400);
      if (!equal(input.code.trim().toLowerCase(), deps.code)) {
        failures += 1;
        throw new HttpFailure(401);
      }
      const cookies = await tokenSession(request, deps, deps.token, false);
      return response(200, { signedIn: true }, cookies);
    } catch (error) {
      return response(error instanceof HttpFailure ? error.status : 503, {
        error:
          "Developer sign-in failed. Check the code in the pnpm dev output.",
      });
    }
  };
}
