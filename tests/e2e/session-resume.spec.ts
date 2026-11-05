import { expect, test, type Page } from "@playwright/test";
import { APP, installCookieFixture } from "./cookie-fixture";

test.use({ serviceWorkers: "block" });
const projects = [
  { id: "other", shortName: "OTHER", name: "Synthetic Other" },
  { id: "pmon", shortName: "PMON", name: "Synthetic PMON" },
];
const fixture = async (page: Page, userId = "fixture-owner") => {
  await installCookieFixture(page);
  await page.route(APP + "/api/youtrack?*", (route) => {
    if (route.request().method() !== "GET") throw Error("Unexpected mutation");
    return route.fulfill({ json: [] });
  });
  await page.route(APP + "/api/auth/session", (route) =>
    route.fulfill({
      json: {
        userId,
        projects,
        csrf: "synthetic",
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      },
    }),
  );
};
const pmon = (page: Page) =>
  page.getByRole("button", { name: "Change project: Synthetic PMON (PMON)" });

test("fresh multi-project session opens PMON and resumes after page close", async ({
  page,
  context,
}) => {
  await fixture(page);
  await page.goto(APP);
  await expect(pmon(page)).toBeVisible();
  await page.reload();
  await expect(pmon(page)).toBeVisible();
  await page.close();
  const reopened = await context.newPage();
  await fixture(reopened);
  await reopened.goto(APP);
  await expect(pmon(reopened)).toBeVisible();
});

test("intentional project switch persists and another account defaults to PMON", async ({
  page,
}) => {
  await fixture(page);
  await page.goto(APP);
  await pmon(page).click();
  await page
    .getByRole("button", { name: "Synthetic Other (OTHER)", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Synthetic Other", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Synthetic Other", exact: true }),
  ).toBeVisible();
  await fixture(page, "different-account");
  await page.reload();
  await expect(pmon(page)).toBeVisible();
});

test("optional storage failure does not block valid PMON cookie resume", async ({
  page,
}) => {
  await fixture(page);
  await page.addInitScript(() => {
    for (const name of ["sessionStorage", "localStorage"])
      Object.defineProperty(window, name, {
        configurable: true,
        get: () => {
          throw new DOMException("Denied", "SecurityError");
        },
      });
  });
  await page.goto(APP);
  await expect(pmon(page)).toBeVisible();
});

test("expired cookie cannot open a saved PMON workspace", async ({ page }) => {
  await fixture(page);
  await page.goto(APP);
  await expect(pmon(page)).toBeVisible();
  await page.route(APP + "/api/auth/session", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Sign in to ROMDex" }),
  ).toBeVisible();
  await expect(pmon(page)).toHaveCount(0);
});

test("opt-in is explicit and unchecked before a new YouTrack sign-in", async ({
  page,
}) => {
  await fixture(page);
  await page.route(APP + "/api/auth/session", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.goto(APP);
  const remember = page.getByRole("checkbox", {
    name: "Keep me signed in on this device (30 days)",
  });
  await expect(remember).not.toBeChecked();
  await remember.check();
  let requested: unknown;
  await page.route(APP + "/api/auth/start", (route) => {
    requested = route.request().postDataJSON();
    return route.fulfill({ status: 503, json: {} });
  });
  await page
    .getByRole("button", { name: "Sign in with YouTrack", exact: true })
    .click();
  await expect.poll(() => requested).toEqual({ rememberDevice: true });
});

test("expired opted-in session renews once and opens PMON without a sign-in click", async ({
  page,
}) => {
  await fixture(page);
  let renewed = false,
    posts = 0;
  await page.route(APP + "/api/auth/session", (route) =>
    route.fulfill(
      renewed
        ? {
            json: {
              userId: "fixture-owner",
              projects,
              csrf: "c".repeat(43),
              expiresAt: Date.now() / 1000 + 300,
            },
          }
        : {
            status: 401,
            json: {
              renewable: true,
              csrf: "c".repeat(43),
              renewalId: "r".repeat(43),
              renewUntil: Math.floor(Date.now() / 1000) + 3600,
            },
          },
    ),
  );
  await page.route(APP + "/api/auth/renew", (route) => {
    posts++;
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({
      renewalId: "r".repeat(43),
    });
    renewed = true;
    return route.fulfill({ json: { renewed: true } });
  });
  await page.goto(APP);
  await expect(pmon(page)).toBeVisible();
  expect(posts).toBe(1);
  await page.reload();
  await expect(pmon(page)).toBeVisible();
  expect(posts).toBe(1);
});

test("lost renewal response is not replayed after reload", async ({ page }) => {
  await fixture(page);
  let posts = 0;
  await page.route(APP + "/api/auth/session", (route) =>
    route.fulfill({
      status: 401,
      json: {
        renewable: true,
        csrf: "c".repeat(43),
        renewalId: "r".repeat(43),
        renewUntil: Math.floor(Date.now() / 1000) + 3600,
      },
    }),
  );
  await page.route(APP + "/api/auth/renew", (route) => {
    posts++;
    return route.abort();
  });
  await page.goto(APP);
  await expect(
    page.getByText(
      "Sign in again to renew this session. Local work is preserved.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText(
      "Sign in again to renew this session. Local work is preserved.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(posts).toBe(1);
});
