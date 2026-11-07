import { expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import {
  FENCE,
  LOGIN,
  openCookie,
  RENEWAL,
  SESSION,
} from "../../server/cookie-codec";
import {
  createCookieHandler,
  type CookieDependencies,
} from "../../server/cookie-runtime";
import { APP, installCookieFixture } from "./cookie-fixture";

// Real encrypted envelopes and handler responses with a synthetic OAuth port.
// Playwright interception omits Fetch Metadata in the QA Chromium runtime. This
// adapter synthesizes ONLY missing Sec-Fetch-Site after checking the caller frame
// and browser Origin. Cookie requests, Set-Cookie acceptance and response ordering
// remain real browser behavior; production Fetch Metadata enforcement is covered
// by server unit tests. Playwright does not route later HTTP redirect requests.
// The adapter asserts the handler's exact callback 303/Location, then replaces
// that redirect with a fresh test-only document navigation (or a fetch reply).
// Native HTTP redirect following is not claimed by this isolated harness.
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
      verify: async (token) => {
        if (token === "revoked-token") throw Error("Synthetic revoked token");
        return {
          id: owners.get(token) ?? "fixture-owner",
          guest: false,
          projects: [{ id: "0-1", shortName: "PMON", name: "Synthetic PMON" }],
        };
      },
      refresh: async () => ({
        accessToken: "synthetic-renewed",
        expiresIn: 300,
        refreshToken: "synthetic-rotated",
      }),
    },
  };
  const handle = createCookieHandler(deps);
  const callbacks: {
    status: number;
    navigation: boolean;
    providerReturn: boolean;
    hasFence: boolean;
    hasLogin: boolean;
    expectedRedirect: boolean;
  }[] = [];
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
    // A controlled synthetic provider document may return only to the main-frame
    // GET callback. All other callers must still have the exact app origin.
    const source = new URL(request.frame().url());
    const callback = new URL(request.url()).pathname === "/api/auth/callback";
    const providerReturn = source.origin !== APP;
    if (providerReturn) {
      expect(
        callback && request.isNavigationRequest() && request.method() === "GET",
        "Only a top-level provider callback may be cross-origin",
      ).toBe(true);
      expect(request.frame() === page.mainFrame()).toBe(true);
      expect(source.origin).toBe("https://thegobindsingh.youtrack.cloud");
      expect(source.pathname).toBe("/hub/api/rest/oauth2/auth");
      expect(source.searchParams.get("client_id")).toBe("synthetic-client");
      expect(source.searchParams.get("redirect_uri")).toBe(
        APP + "/api/auth/callback",
      );
      expect(new URL(request.url()).searchParams.get("code")).toBe("synthetic");
    } else expect(source.origin, "Synthetic caller frame origin").toBe(APP);
    // Never replace Origin, Cookie, CSRF, or supplied Fetch Metadata values.
    expect(new URL(request.url()).origin, "Synthetic request destination").toBe(
      APP,
    );
    if (request.method() === "POST" || browserHeaders.origin !== undefined)
      expect(browserHeaders.origin, "Real browser Origin").toBe(
        providerReturn ? source.origin : APP,
      );
    const handlerHeaders = { ...browserHeaders };
    if (browserHeaders["sec-fetch-site"] === undefined) {
      expect(Object.hasOwn(browserHeaders, "sec-fetch-site")).toBe(false);
      handlerHeaders["sec-fetch-site"] = providerReturn
        ? "cross-site"
        : "same-origin";
    }
    // Boolean assertion avoids printing cookie values even on a fixture failure.
    expect(
      handlerHeaders.cookie === browserHeaders.cookie,
      "Browser Cookie header is forwarded unchanged",
    ).toBe(true);
    const response = await handle(
      new Request(request.url(), {
        method: request.method(),
        headers: handlerHeaders,
        ...(request.postData() ? { body: request.postData()! } : {}),
      }),
    );
    if (callback) {
      const names = (browserHeaders.cookie ?? "")
        .split(";")
        .map((cookie) => cookie.trim().split("=")[0]);
      const diagnostic = {
        status: response.status,
        navigation: request.isNavigationRequest(),
        providerReturn,
        hasFence: names.includes(FENCE),
        hasLogin: names.includes(LOGIN),
        expectedRedirect:
          response.headers.get("location") === APP + "/?auth=complete",
      };
      callbacks.push(diagnostic);
      expect(
        diagnostic,
        "Synthetic callback status and browser cookie delivery",
      ).toMatchObject({
        status: 303,
        hasFence: true,
        hasLogin: true,
        expectedRedirect: true,
      });
    }
    const cookies = response.headers
      .getSetCookie()
      .map((cookie) =>
        cookie.startsWith(rejectCookie + "=")
          ? cookie.replace("Path=/;", "Path=/rejected;")
          : cookie,
      );
    const headers = Object.fromEntries(
      [...response.headers].filter(
        ([key]) => key !== "set-cookie" && !(callback && key === "location"),
      ),
    );
    if (cookies.length) headers["set-cookie"] = cookies.join("\n");
    await route.fulfill({
      status: callback ? 200 : response.status,
      headers: callback
        ? {
            ...headers,
            "content-type": request.isNavigationRequest()
              ? "text/html"
              : "application/json",
          }
        : headers,
      body: callback
        ? request.isNavigationRequest()
          ? '<!doctype html><title>Synthetic callback return</title><script>location.replace("/?auth=complete")</script>'
          : JSON.stringify({ callbackComplete: true })
        : await response.text(),
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
    // The adapter validates the callback's redirect and stores the real cookies,
    // without letting a redirect escape Playwright routing to the live origin.
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
    callbacks,
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
