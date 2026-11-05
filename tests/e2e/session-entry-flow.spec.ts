import { expect, test, type Page } from "@playwright/test";
import { RENEWAL } from "../../server/cookie-codec";
import { APP, installCookieFixture } from "./cookie-fixture";
import { durableCookieFixture } from "./durable-cookie-fixture";

test.use({ serviceWorkers: "block" });
const projects = [
  { id: "other", shortName: "OTHER", name: "Synthetic Other" },
  { id: "pmon", shortName: "PMON", name: "Synthetic PMON" },
];
const session = () => ({
  userId: "fixture-owner",
  projects,
  csrf: "synthetic",
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
});
const pmon = (page: Page) =>
  page.getByRole("button", { name: "Change project: Synthetic PMON (PMON)" });
const remember = (page: Page) =>
  page.getByRole("checkbox", {
    name: "Keep me signed in on this device (30 days)",
  });
const noChooser = async (page: Page) => {
  await expect(
    page.getByRole("heading", { name: "Choose your project" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Synthetic Other (OTHER)", exact: true }),
  ).toHaveCount(0);
};

test("delayed sign-in verification and PMON loading never flash sign-in controls or a project chooser", async ({
  page,
}) => {
  await installCookieFixture(page);
  let releaseSession = () => {},
    releaseProject = () => {},
    projectReads = 0;
  const waitingSession = new Promise<void>((resolve) => {
    releaseSession = resolve;
  });
  const waitingProject = new Promise<void>((resolve) => {
    releaseProject = resolve;
  });
  await page.route(APP + "/api/auth/session", async (route) => {
    await waitingSession;
    return route.fulfill({ json: session() });
  });
  await page.route(APP + "/api/youtrack?*", async (route) => {
    expect(route.request().method()).toBe("GET");
    projectReads++;
    await waitingProject;
    return route.fulfill({ json: [] });
  });
  try {
    await page.goto(APP);
    await expect(
      page.getByRole("heading", { name: "Opening ROMDex…" }),
    ).toBeVisible();
    await expect(remember(page)).toHaveCount(0);
    await noChooser(page);
    releaseSession();
    await expect.poll(() => projectReads).toBeGreaterThan(0);
    await expect(
      page.getByRole("heading", { name: "Opening ROMDex…" }),
    ).toBeVisible();
    await expect(remember(page)).toHaveCount(0);
    await noChooser(page);
    releaseProject();
    await expect(pmon(page)).toBeVisible();
    await noChooser(page);
  } finally {
    releaseSession();
    releaseProject();
  }
});

test("failed automatic PMON read offers recovery retry instead of the old project chooser", async ({
  page,
}) => {
  await installCookieFixture(page);
  let failing = true,
    signIns = 0;
  await page.route(APP + "/api/auth/session", (route) =>
    route.fulfill({ json: session() }),
  );
  await page.route(APP + "/api/auth/start", (route) => {
    signIns++;
    return route.fulfill({ status: 503, json: {} });
  });
  await page.route(APP + "/api/youtrack?*", (route) => {
    expect(route.request().method()).toBe("GET");
    return route.fulfill(failing ? { status: 503, json: {} } : { json: [] });
  });
  await page.goto(APP);
  await expect(
    page.getByRole("heading", { name: "Connection needs attention" }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Could not open PMON." }),
  ).toBeVisible();
  await noChooser(page);
  await expect(remember(page)).not.toBeChecked();
  failing = false;
  await page.getByRole("button", { name: "Retry opening ROMDex" }).click();
  await expect(pmon(page)).toBeVisible();
  await noChooser(page);
  expect(signIns).toBe(0);
});

test("actual synthetic callback navigation opens PMON and signed-in opt-in requires a new explicit provider sign-in", async ({
  page,
}) => {
  const f = await durableCookieFixture(page);
  const requests: unknown[] = [],
    accessTypes: string[] = [];
  page.on("request", (request) => {
    if (request.url() === APP + "/api/auth/start")
      requests.push(request.postDataJSON());
  });
  await page.route(APP + "/api/youtrack?*", (route) => {
    expect(route.request().method()).toBe("GET");
    return route.fulfill({ json: [] });
  });
  await page.route(
    "https://thegobindsingh.youtrack.cloud/hub/api/rest/oauth2/auth?*",
    (route) => {
      const url = new URL(route.request().url());
      expect(url.searchParams.get("client_id")).toBe("synthetic-client");
      expect(url.searchParams.get("redirect_uri")).toBe(
        APP + "/api/auth/callback",
      );
      expect(url.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      accessTypes.push(url.searchParams.get("access_type")!);
      return route.fulfill({
        status: 302,
        headers: {
          location:
            APP +
            "/api/auth/callback?code=synthetic&state=" +
            url.searchParams.get("state"),
        },
      });
    },
  );
  await page.goto(APP);
  await expect(remember(page)).toBeVisible();
  await expect(remember(page)).not.toBeChecked();
  expect(requests).toEqual([]);
  await page
    .getByRole("button", { name: "Sign in with YouTrack", exact: true })
    .click();
  await expect(page).toHaveURL(APP + "/?auth=complete");
  await expect(pmon(page)).toBeVisible();
  await noChooser(page);
  expect(requests).toEqual([{ rememberDevice: false }]);
  expect(accessTypes).toEqual(["online"]);
  expect(await f.cookie(RENEWAL)).toBeUndefined();

  await page.getByRole("button", { name: /^Connection Details/ }).click();
  await page.getByText("Keep this device signed in", { exact: true }).click();
  await expect(remember(page)).not.toBeChecked();
  await remember(page).check();
  expect(requests).toEqual([{ rememberDevice: false }]);
  expect(await f.cookie(RENEWAL)).toBeUndefined();
  const returned = page.waitForEvent("framenavigated", {
    predicate: (frame) =>
      frame === page.mainFrame() && frame.url() === APP + "/?auth=complete",
  });
  await page
    .getByRole("button", { name: "Sign in again with YouTrack", exact: true })
    .click();
  await returned;
  await expect(pmon(page)).toBeVisible();
  await expect
    .poll(() => requests)
    .toEqual([{ rememberDevice: false }, { rememberDevice: true }]);
  await expect.poll(() => accessTypes).toEqual(["online", "offline"]);
  await expect.poll(async () => Boolean(await f.cookie(RENEWAL))).toBe(true);
  await expect(page).toHaveURL(APP + "/?auth=complete");
  await expect(pmon(page)).toBeVisible();
  await noChooser(page);
  await page.reload();
  await expect(pmon(page)).toBeVisible();
  expect(requests).toHaveLength(2);
});
