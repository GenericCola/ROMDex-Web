import assert from "node:assert/strict";
import { FENCE } from "./cookie-codec.ts";
import {
  createCookieHandler,
  type CookieDependencies,
} from "./cookie-runtime.ts";
const origin = "https://romdex.vercel.app";
export function fixture() {
  let now = 1000,
    counter = 0;
  const jar = new Map<string, string>();
  const deps: CookieDependencies = {
    key: new Uint8Array(32).fill(7),
    now: () => now,
    entropy: () => (++counter).toString(16).padStart(43, "a"),
    clientId: "synthetic-client",
    maxSeconds: 3600,
    oauth: {
      exchange: async () => ({
        accessToken: "synthetic-access",
        expiresIn: 600,
        refreshToken: "must-never-retain",
      }),
      verify: async () => ({
        id: "non-owner",
        guest: false,
        projects: [{ id: "project-a", name: "Project A", shortName: "A" }],
      }),
    },
  };
  const handle = createCookieHandler(deps);
  function apply(response: Response) {
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0]!;
      const index = pair.indexOf("=");
      const name = pair.slice(0, index),
        value = pair.slice(index + 1);
      if (value) jar.set(name, value);
      else jar.delete(name);
    }
  }
  function request(path: string, method = "GET", csrf?: string) {
    return new Request(origin + path, {
      method,
      headers: {
        origin,
        "sec-fetch-site": "same-origin",
        cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
        ...(csrf ? { "x-romdex-csrf": csrf } : {}),
      },
    });
  }
  async function start() {
    jar.set(FENCE, deps.entropy());
    const result = await handle(request("/api/auth/start", "POST"));
    apply(result);
    const body = await result.json();
    return {
      csrf: body.csrf as string,
      state: new URL(body.authorizationUrl).searchParams.get("state")!,
      url: body.authorizationUrl as string,
    };
  }
  async function login() {
    const flow = await start();
    const result = await handle(
      request(
        "/api/auth/callback?state=" + flow.state + "&code=synthetic-code",
      ),
    );
    assert.equal(result.status, 303);
    apply(result);
    return flow;
  }
  return {
    deps,
    jar,
    handle,
    apply,
    request,
    start,
    login,
    advance: (seconds: number) => {
      now += seconds;
    },
  };
}
