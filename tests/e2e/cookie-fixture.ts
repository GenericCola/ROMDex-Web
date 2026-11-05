import { expect, type Page, type Route } from "@playwright/test";
import { resolve } from "node:path";
export const APP = "https://romdex.vercel.app";
const YOUTRACK = "https://thegobindsingh.youtrack.cloud";
export const installCookieFixture = async (
  page: Page,
  { preserveGeneration = false }: { preserveGeneration?: boolean } = {},
) => {
  await page.context().route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== APP) return route.abort();
    if (url.pathname === "/__attachment-transport") {
      const response = await route.fetch({
        url: "http://127.0.0.1:3100/__attachment-transport",
      });
      return route.fulfill({ response });
    }
    const root = resolve("out"),
      file = resolve(
        root,
        "." + url.pathname + (url.pathname.endsWith("/") ? "index.html" : ""),
      );
    if (!file.startsWith(root + "/") && !file.startsWith(root + "\\"))
      throw Error("Invalid synthetic asset path");
    await route.fulfill({ path: file });
  });
  // Reopen tests must not replace the generation loaded from the disk profile.
  if (!preserveGeneration)
    await page.context().addCookies([
      {
        name: "__Host-romdex-generation",
        value: "f".repeat(43),
        url: APP + "/",
        secure: true,
        sameSite: "Lax",
      },
    ]);
  await page.route(APP + "/api/auth/session", (route) =>
    route.fulfill({
      json: {
        userId: "fixture-owner",
        projects: [{ id: "0-1", shortName: "PMON", name: "Synthetic PMON" }],
        csrf: "synthetic-csrf",
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      },
    }),
  );
};
export const routeYouTrack = async (
  page: Page,
  pattern: string,
  handle: (route: Route) => Promise<unknown>,
) => {
  await page.route(pattern, handle);
  const expression = new RegExp(
    "^" +
      pattern
        .split(/(\*\*|\*)/)
        .map((part) =>
          part === "**"
            ? ".*"
            : part === "*"
              ? "[^/]*"
              : part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"),
        )
        .join("") +
      "$",
  );
  const bridge = async (route: Route) => {
    const request = route.request(),
      url = new URL(request.url());
    const remote =
      url.pathname === "/api/attachment"
        ? YOUTRACK + "/api/files/" + url.searchParams.get("id")
        : YOUTRACK + "/api/" + (url.searchParams.get("route") ?? "");
    if (!expression.test(remote)) return route.fallback();
    const virtualRequest = new Proxy(request, {
      get: (target, key) => {
        if (key === "url") return () => remote;
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const virtualRoute = new Proxy(route, {
      get: (target, key) => {
        if (key === "request") return () => virtualRequest;
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    await handle(virtualRoute);
  };
  await page.route(APP + "/api/youtrack?*", bridge);
  if (pattern.includes("/api/files/"))
    await page.route(APP + "/api/attachment?*", bridge);
};
export const openCookieFixture = async (page: Page) => {
  await page.goto(APP + "/");
  await expect(
    page.getByRole("button", { name: /^Save Changes/ }),
  ).toBeVisible();
  const automatic = page.getByRole("switch", {
    name: "Auto-Sync Data",
    exact: true,
  });
  if ((await automatic.getAttribute("aria-checked")) === "true")
    await automatic.click();
  await expect(automatic).toHaveAttribute("aria-checked", "false");
};
