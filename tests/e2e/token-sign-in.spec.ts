import { expect, test } from "@playwright/test";
import { SESSION } from "../../server/cookie-codec";
import { APP } from "./cookie-fixture";
import { durableCookieFixture } from "./durable-cookie-fixture";

test.use({ serviceWorkers: "block" });
const TOKEN = "synthetic-permanent-token";

test("a pasted permanent token signs in once and is kept only in the sealed cookie", async ({
  page,
}) => {
  const f = await durableCookieFixture(page);
  const posted: unknown[] = [];
  page.on("request", (request) => {
    if (request.url() === APP + "/api/auth/token")
      posted.push(request.postDataJSON());
  });
  await page.route(APP + "/api/youtrack?*", (route) => {
    expect(route.request().method()).toBe("GET");
    return route.fulfill({ json: [] });
  });
  await page.goto(APP);
  const field = page.getByLabel("YouTrack permanent token");
  const submit = page.getByRole("button", {
    name: "Sign in with a permanent token",
  });
  await expect(field).toHaveAttribute("type", "password");
  await expect(submit).toBeDisabled();

  await field.fill("revoked-token");
  await submit.click();
  await expect(
    page.getByText("YouTrack did not accept that token"),
  ).toHaveAttribute("role", "alert");
  await expect(field).toHaveValue("");
  expect(await f.cookie(SESSION)).toBeUndefined();

  await field.fill(TOKEN);
  await submit.click();
  await expect(
    page.getByRole("button", { name: "Change project: Synthetic PMON (PMON)" }),
  ).toBeVisible();
  expect(posted).toEqual([
    { token: "revoked-token", rememberDevice: false },
    { token: TOKEN, rememberDevice: false },
  ]);
  const session = await f.cookie(SESSION);
  expect(session?.httpOnly).toBe(true);
  expect(session?.value.includes(TOKEN)).toBe(false);
  expect((await f.envelope(SESSION)).permanent).toBe(true);
  const stored = await page.evaluate(async () => {
    const names = (await indexedDB.databases()).map((db) => db.name);
    return (
      JSON.stringify({ ...localStorage }) +
      JSON.stringify({ ...sessionStorage }) +
      document.cookie +
      names.join()
    );
  });
  expect(stored.includes(TOKEN)).toBe(false);
});
