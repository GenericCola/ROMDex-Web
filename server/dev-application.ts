// DEVELOPMENT ONLY. Served by dev-api.ts behind `next dev`; api/index.ts never imports it.
import { randomBytes } from "node:crypto";
import {
  createApplication,
  productionDependencies,
  type ApplicationDependencies,
} from "./application.ts";
import {
  createDevTokenLogin,
  DEV_TOKEN_ROUTE,
  type DevTokenDependencies,
} from "./dev-token.ts";
import { response } from "./runtime-http.ts";
export const DEV_ORIGINS = [
  "http://localhost:3000",
  "https://nextjsdev.letmecome.in",
];
export interface DevDependencies
  extends ApplicationDependencies, DevTokenDependencies {
  origins: string[];
}
export function devDependencies(
  env: NodeJS.ProcessEnv = process.env,
): DevDependencies {
  // A fresh key per process: restarting `pnpm dev` signs every dev browser out.
  const key = env.ROMDEX_SESSION_KEY ?? randomBytes(32).toString("base64url");
  return {
    ...productionDependencies({ ...env, ROMDEX_SESSION_KEY: key }),
    token: env.YOUTRACK_TOKEN ?? "",
    // DEV_SERVER_ORIGIN adds another public address that proxies to `pnpm dev`.
    origins: [
      ...new Set([...DEV_ORIGINS, env.DEV_SERVER_ORIGIN ?? DEV_ORIGINS[0]!]),
    ],
  };
}
/**
 * `next dev` proxies /api/* here, so the request URL names 127.0.0.1. Put the browser's
 * origin back (or, for requests without Origin, the first dev origin) so the normal origin,
 * CSRF and cookie checks run unchanged. Foreign origins are refused.
 */
function asBrowserRequest(request: Request, origins: string[]) {
  const origin = request.headers.get("origin") ?? origins[0];
  if (origin === undefined || !origins.includes(origin)) return null;
  const url = new URL(request.url);
  const init: RequestInit & { duplex: "half" } = {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal: request.signal,
    duplex: "half",
  };
  return new Request(origin + url.pathname + url.search, init);
}
export function createDevApplication(deps: DevDependencies) {
  const app = createApplication(deps);
  const devTokenLogin = createDevTokenLogin(deps);
  return async function handleDev(request: Request): Promise<Response> {
    const translated = asBrowserRequest(request, deps.origins);
    if (!translated) return response(403, { error: "Unknown dev origin" });
    return new URL(translated.url).pathname === DEV_TOKEN_ROUTE
      ? devTokenLogin(translated)
      : app(translated);
  };
}
