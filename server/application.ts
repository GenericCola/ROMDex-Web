import { randomBytes } from "node:crypto";
import { authorizeCookie } from "./cookie-authorize.ts";
import {
  createCookieHandler,
  type CookieDependencies,
} from "./cookie-runtime.ts";
import { oauthUpstream } from "./oauth-upstream.ts";
import { response } from "./runtime-http.ts";
import { HttpFailure } from "./runtime-types.ts";
import { ORIGIN } from "./session-contract.ts";
import { downloadAttachment, jsonProxy } from "./youtrack.ts";
export interface ApplicationDependencies extends CookieDependencies {
  fetch: typeof fetch;
}
export function createApplication(deps: ApplicationDependencies) {
  const auth = createCookieHandler(deps);
  return async function handle(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.origin !== ORIGIN) throw new HttpFailure(403);
      if (url.pathname.startsWith("/api/auth/")) return await auth(request);
      if (!["/api/youtrack", "/api/attachment"].includes(url.pathname))
        throw new HttpFailure(404);
      const session = await authorizeCookie(
        request,
        deps,
        request.method !== "GET",
      );
      return url.pathname === "/api/attachment"
        ? await downloadAttachment(request, session, deps)
        : await jsonProxy(request, session, deps);
    } catch (error) {
      return response(error instanceof HttpFailure ? error.status : 502, {
        error:
          "YouTrack request could not be completed. Local changes are preserved.",
      });
    }
  };
}
export function productionDependencies(
  env: NodeJS.ProcessEnv = process.env,
): ApplicationDependencies {
  const encoded = env.ROMDEX_SESSION_KEY ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(encoded))
    throw new Error("Session configuration unavailable");
  const key = Buffer.from(encoded, "base64url");
  if (key.byteLength !== 32 || key.toString("base64url") !== encoded)
    throw new Error("Session configuration unavailable");
  const clientId = env.ROMDEX_OAUTH_CLIENT_ID ?? "romdex-web";
  return {
    key,
    clientId,
    now: () => Math.floor(Date.now() / 1000),
    entropy: () => randomBytes(32).toString("base64url"),
    maxSeconds: 3600,
    oauth: oauthUpstream(clientId),
    fetch,
  };
}
export async function productionHandler(request: Request): Promise<Response> {
  try {
    return await createApplication(productionDependencies())(request);
  } catch {
    return response(503, {
      error: "Server sign-in is not configured. Local changes are preserved.",
    });
  }
}
