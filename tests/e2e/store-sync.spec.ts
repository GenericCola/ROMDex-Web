import { expect, test } from "@playwright/test";
import { routeYouTrack } from "./cookie-fixture";
import { structuralFixture } from "./structural-fixture";

test.use({ serviceWorkers: "block" });

test("a missing store article shows Not set up and is created only after confirming", async ({
  page,
}) => {
  const writes: string[] = [];
  await structuralFixture(page);
  await routeYouTrack(
    page,
    "https://thegobindsingh.youtrack.cloud/api/articles*",
    async (route) => {
      if (route.request().method() !== "GET")
        writes.push(route.request().method());
      await route.fulfill({ json: [] });
    },
  );
  await page.getByRole("button", { name: /^Connection Details/ }).click();
  const sync = page.getByRole("region", { name: "YouTrack data sync" });
  await expect(sync).toContainText("ROMDex data:");
  await expect(sync).toContainText(
    'NPCDex data: Not set up: YouTrack has no "NPCDex data" article.',
    { timeout: 15000 },
  );
  await sync
    .getByRole("button", { name: "Set up in YouTrack…" })
    .last()
    .click();
  await expect(sync).toContainText(
    'Create a private "NPCDex data" article in YouTrack, visible to thegobindsingh and GenericCola?',
  );
  await sync.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    sync.getByRole("button", { name: "Create article" }),
  ).toHaveCount(0);
  expect(writes).toEqual([]);
});
