import { expect, type BrowserContext, type Page } from "@playwright/test";
import { LOCAL_ORIGIN } from "./local-origin";
// Normal mode shows no "All changes saved" text (it is recovery-mode only), so
// local saves are confirmed by reading what reached the browser database.
export const stored = (page: Page) => {
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open("romdex-web-workspace", 1);
        open.onerror = () => reject(Error("Open failed"));
        open.onsuccess = () => {
          const db = open.result;
          // Records are keyed per account, so read every key.
          const get = db
            .transaction("workspace")
            .objectStore("workspace")
            .getAll();
          get.onsuccess = () => {
            resolve(JSON.stringify(get.result));
            db.close();
          };
          get.onerror = () => reject(Error("Read failed"));
        };
      }),
  );
};
export const savedLocally = async (page: Page, text: string) => {
  await expect.poll(() => stored(page)).toContain(text);
};
// The synthetic signed-in app on the local preview origin. Update tests need
// it: a service-worker script update bypasses page routes, so on a fixture
// origin it would be fetched from the real site. Here the preview serves it.
export const routeLocalWorkspace = async (
  context: BrowserContext,
  { csrf = "synthetic-csrf", issues = [] as unknown[] } = {},
) => {
  // Playwright refuses a Secure cookie for http, so the page sets it itself.
  await context.addInitScript(() => {
    if (!document.cookie.includes("__Host-romdex-generation="))
      document.cookie =
        "__Host-romdex-generation=" +
        "f".repeat(43) +
        "; Path=/; Secure; SameSite=Lax";
  });
  await context.route(LOCAL_ORIGIN + "/api/auth/session", (route) =>
    route.fulfill({
      json: {
        userId: "fixture-owner",
        projects: [{ id: "0-1", shortName: "PMON", name: "Synthetic PMON" }],
        csrf,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      },
    }),
  );
  await context.route(LOCAL_ORIGIN + "/api/youtrack?*", (route) => {
    const path = new URL(
      "https://thegobindsingh.youtrack.cloud/api/" +
        (new URL(route.request().url()).searchParams.get("route") ?? ""),
    ).pathname;
    const fields = ["Type", "State", "Priority", "Complexity"];
    const body =
      path === "/api/users/me"
        ? { id: "fixture-owner" }
        : path === "/api/admin/projects"
          ? [{ id: "0-1", shortName: "PMON" }]
          : path === "/api/admin/projects/0-1/customFields"
            ? fields.map((name, i) => ({
                id: "92-" + i,
                field: {
                  name,
                  fieldType: { id: name === "State" ? "state[1]" : "enum[1]" },
                },
              }))
            : path.endsWith("/attachments")
              ? []
              : path === "/api/issues"
                ? issues
                : path === "/api/articles"
                  ? []
                  : null;
    if (!body) throw Error("Unexpected fixture request " + path);
    return route.fulfill({ json: body });
  });
};
export const openLocalWorkspace = async (page: Page) => {
  await page.goto("/");
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
// Recovery mode (?recovery=1) is where the migration, recovery export and local
// save status controls live; delivery stays disconnected there.
export const openRecoveryWorkspace = async (page: Page) => {
  await routeLocalWorkspace(page.context());
  await page.goto("/?recovery=1");
  await expect(
    page.getByRole("button", {
      name: "Import Desktop or Recovery Data",
      exact: true,
    }),
  ).toBeVisible();
};
