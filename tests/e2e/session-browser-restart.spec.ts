import { expect, test, type BrowserContext } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FENCE, RENEWAL, SESSION } from "../../server/cookie-codec";
import { APP, routeYouTrack } from "./cookie-fixture";
import { durableCookieFixture } from "./durable-cookie-fixture";
type Cookie = Awaited<ReturnType<BrowserContext["cookies"]>>[number];

const comparableCookies = (cookies: Cookie[]) =>
  cookies
    .map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      expires: cookie.expires,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
test("durable cookies survive a real browser restart and renew into PMON", async ({
  playwright,
}, testInfo) => {
  // Persistent Chromium contexts close their owned browser process. This is not
  // a new page/context or a storageState export/import simulation of restart.
  const profile = await mkdtemp(join(tmpdir(), "romdex-synthetic-restart-"));
  const use = testInfo.project.use;
  const launch = () =>
    playwright.chromium.launchPersistentContext(profile, {
      ...use.launchOptions,
      ...(use.headless === undefined ? {} : { headless: use.headless }),
      ...(use.channel === undefined ? {} : { channel: use.channel }),
      ...(use.viewport === undefined ? {} : { viewport: use.viewport }),
      ...(use.userAgent === undefined ? {} : { userAgent: use.userAgent }),
      ...(use.isMobile === undefined ? {} : { isMobile: use.isMobile }),
      ...(use.hasTouch === undefined ? {} : { hasTouch: use.hasTouch }),
      ...(use.deviceScaleFactor === undefined
        ? {}
        : { deviceScaleFactor: use.deviceScaleFactor }),
      serviceWorkers: "block",
    });
  let context: BrowserContext | undefined;
  try {
    context = await launch();
    const first = context.pages()[0] ?? (await context.newPage());
    const initial = await durableCookieFixture(first);
    await initial.login();
    const saved = (await context.cookies(APP)).filter((cookie) =>
      [FENCE, SESSION, RENEWAL].includes(cookie.name),
    );
    expect(saved).toHaveLength(3);
    for (const cookie of saved) {
      expect(cookie.expires).toBeGreaterThan(Date.now() / 1000);
      expect(cookie.secure).toBe(true);
      expect(cookie.httpOnly).toBe(cookie.name !== FENCE);
    }
    const originalDeadline = (await initial.envelope(RENEWAL)).expiresAt;
    // Leave no production-looking URL for browser startup/session restoration.
    await first.goto("about:blank");
    await context.close();
    context = undefined;

    context = await launch();
    // CRITICAL: inspect the new process's cookie store BEFORE routes, helper
    // setup, login, cookie injection, or any navigation can reconstruct it.
    const persisted = (await context.cookies(APP)).filter((cookie) =>
      [FENCE, SESSION, RENEWAL].includes(cookie.name),
    );
    expect(comparableCookies(persisted)).toEqual(comparableCookies(saved));
    const reopened = context.pages()[0] ?? (await context.newPage());
    const resumed = await durableCookieFixture(reopened, {
      preserveGeneration: true,
    });
    expect((await resumed.cookie(FENCE))!.value).toBe(
      saved.find((cookie) => cookie.name === FENCE)!.value,
    );
    expect((await resumed.cookie(SESSION))!.value).toBe(
      saved.find((cookie) => cookie.name === SESSION)!.value,
    );
    expect((await resumed.cookie(RENEWAL))!.value).toBe(
      saved.find((cookie) => cookie.name === RENEWAL)!.value,
    );
    resumed.advance(600);
    let renewals = 0;
    const refresh = resumed.deps.oauth.refresh!;
    resumed.deps.oauth.refresh = async (token) => {
      renewals++;
      return refresh(token);
    };
    await routeYouTrack(
      reopened,
      "https://thegobindsingh.youtrack.cloud/api/**",
      async (route) => {
        expect(route.request().method()).toBe("GET");
        const path = new URL(route.request().url()).pathname;
        if (path === "/api/users/me")
          return route.fulfill({ json: { id: "fixture-owner" } });
        return route.fulfill({ json: [] });
      },
    );
    await reopened.goto(APP);
    await expect(
      reopened.getByRole("button", {
        name: "Change project: Synthetic PMON (PMON)",
      }),
    ).toBeVisible();
    await expect(
      reopened.getByRole("heading", { name: "Sign in to ROMDex" }),
    ).toHaveCount(0);
    expect(renewals).toBe(1);
    expect((await resumed.envelope(RENEWAL)).expiresAt).toBe(originalDeadline);
    await reopened.reload();
    await expect(
      reopened.getByRole("button", {
        name: "Change project: Synthetic PMON (PMON)",
      }),
    ).toBeVisible();
    expect(renewals).toBe(1);
  } finally {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
  }
});
