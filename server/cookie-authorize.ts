// SERVER ONLY. Never export this module through a client barrel or return its value as JSON.
import { SESSION } from "./cookie-codec.ts";
import { bound, equal, type CookieDependencies } from "./cookie-runtime.ts";
import { sameOrigin, validIdentity } from "./runtime-http.ts";
import { HttpFailure } from "./runtime-types.ts";
export async function authorizeCookie(
  request: Request,
  deps: CookieDependencies,
  mutation: boolean,
) {
  if (request.headers.get("sec-fetch-site") !== "same-origin")
    throw new HttpFailure(403);
  const value = await bound(request, SESSION, "session", deps);
  if (mutation) {
    sameOrigin(request);
    if (!equal(request.headers.get("x-romdex-csrf") ?? "", value.csrf))
      throw new HttpFailure(403);
  }
  const identity = await deps.oauth.verify(value.accessToken!);
  validIdentity(identity);
  if (
    identity.id !== value.userId ||
    deps.now() >= value.expiresAt ||
    request.signal.aborted
  )
    throw new HttpFailure(401);
  return {
    accessToken: value.accessToken!,
    userId: identity.id,
    expiresAt: value.expiresAt,
    csrf: value.csrf,
    generation: value.fence,
    projects: identity.projects,
  };
}
