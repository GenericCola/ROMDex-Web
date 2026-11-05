import { expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { FENCE, openCookie, RENEWAL, SESSION } from "../../server/cookie-codec";
import {
  createCookieHandler,
  type CookieDependencies,
} from "../../server/cookie-runtime";
import { APP, installCookieFixture } from "./cookie-fixture";

// Real encrypted envelopes and handler responses; only the upstream OAuth port is
// synthetic. Browser acceptance, Cookie requests and response ordering are real.
export async function durableCookieFixture(
  page: Page,
  options: { preserveGeneration?: boolean } = {},
) {
  await installCookieFixture(page, options);
  let now = Math.floor(Date.now() / 1000),
    user = "fixture-owner";
  const owners = new Map<string, string>();
  const deps: CookieDependencies = {
    key: new Uint8Array(32).fill(7),
    now: () => now,
    entropy: () => randomBytes(32).toString("base64url"),
    clientId: "synthetic-client",
    maxSeconds: 3600,
    oauth: {
      exchange: async () => {
        const accessToken = "synthetic-access-" + user;
        owners.set(accessToken, user);
        return {
          accessToken,
          expiresIn: 600,
          refreshToken: "synthetic-refresh-" + user,
        };
      },
      verify: async (token) => ({
        id: owners.get(token) ?? "fixture-owner",
        guest: false,
        projects: [{ id: "0-1", shortName: "PMON", name: "Synthetic PMON" }],
      }),
      refresh: async () => ({
        accessToken: "synthetic-renewed",
        expiresIn: 300,
        refreshToken: "synthetic-rotated",
      }),
    },
  };
  const handle = createCookieHandler(deps);
  let rejectCookie: string | undefined;
  await page.route(APP + "/__cookie-harness", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Synthetic cookie harness</title>",
    }),
  );
  await page.route(APP + "/api/auth/**", async (route) => {
    const request = route.request();
    const browserHeaders = await request.allHeaders();
    const response = await handle(
      new Request(request.url(), {
        method: request.method(),
        headers: browserHeaders,
        ...(request.postData() ? { body: request.postData()! } : {}),
      }),
    );
    if (response.status === 403) {
      // Diagnostic allowlist only. Never print the full header map, request
      // body, cookies, callback query/state, credentials, or response headers.
      // Do not fill in missing security metadata: this run must establish
      // what Playwright actually exposes before choosing a bridge workaround.
      const url = new URL(request.url());
      console.info(
        "Synthetic cookie bridge rejected request metadata",
        JSON.stringify({
          url: url.origin + url.pathname,
          method: request.method(),
          origin: browserHeaders.origin ?? null,
          "sec-fetch-site": browserHeaders["sec-fetch-site"] ?? null,
          "sec-fetch-mode": browserHeaders["sec-fetch-mode"] ?? null,
        }),
      );
    }
    const cookies = response.headers
      .getSetCookie()
      .map((cookie) =>
        cookie.startsWith(rejectCookie + "=")
          ? cookie.replace("Path=/;", "Path=/rejected;")
          : cookie,
      );
    const headers = Object.fromEntries(
      [...response.headers].filter(([key]) => key !== "set-cookie"),
    );
    if (cookies.length) headers["set-cookie"] = cookies.join("\n");
    await route.fulfill({
      status: response.status,
      headers,
      body: await response.text(),
    });
  });
  await page.goto(APP + "/__cookie-harness");
  const call = (path: string, body?: unknown, csrf?: string) =>
    page.evaluate(
      async ({ path, body, csrf }) => {
        const response = await fetch(path, {
          ...(body === undefined
            ? {}
            : {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  ...(csrf ? { "x-romdex-csrf": csrf } : {}),
                },
                body: JSON.stringify(body),
              }),
        });
        return { status: response.status, body: await response.json() };
      },
      { path, body, csrf },
    );
  const login = async (account = "fixture-owner") => {
    user = account;
    await page.evaluate(
      ({ name, value }) => {
        document.cookie = `${name}=${value}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`;
      },
      { name: FENCE, value: deps.entropy() },
    );
    const start = await call("/api/auth/start", { rememberDevice: true });
    expect(start.status).toBe(200);
    const state = new URL(start.body.authorizationUrl).searchParams.get(
      "state",
    );
    // Fetch follows the actual callback redirect but remains inside the synthetic routes.
    await page.evaluate(async (state) => {
      await fetch("/api/auth/callback?state=" + state + "&code=synthetic");
    }, state);
    const session = await call("/api/auth/session");
    expect(session.status).toBe(200);
    expect(session.body.userId).toBe(account);
  };
  const cookie = async (name: string) =>
    (await page.context().cookies(APP)).find((c) => c.name === name);
  const envelope = async (name: typeof SESSION | typeof RENEWAL) =>
    openCookie(
      (await cookie(name))!.value,
      name === SESSION ? "session" : "renewal",
      deps.key,
      now,
    );
  return {
    deps,
    call,
    login,
    cookie,
    envelope,
    advance: (seconds: number) => {
      now += seconds;
    },
    reject: (name?: string) => {
      rejectCookie = name;
    },
  };
}
