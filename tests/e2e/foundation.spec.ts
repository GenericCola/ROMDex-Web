import { expect, test } from "@playwright/test";
test("manifest, headers, icons and 404", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["content-security-policy"]).toContain(
    "https://thegobindsingh.youtrack.cloud",
  );
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons)
    expect((await request.get(icon.src)).ok()).toBeTruthy();
  expect((await request.get("/missing-route/")).status()).toBe(404);
});
test("React controls work without horizontal overflow", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Preview text").fill("Hello");
  await expect(page.getByRole("status").first()).toHaveText("Hello");
  await page.getByRole("button", { name: "Count: 0" }).click();
  await expect(page.getByRole("button", { name: "Count: 1" })).toBeVisible();
  await page.getByRole("button", { name: "Reset preview" }).click();
  await expect(page.getByLabel("Preview text")).toHaveValue("");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
test("cached shell reopens offline in another window", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "ROMDex", exact: true }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.goto("/");
  await expect(other.getByRole("button", { name: "Count: 0" })).toBeVisible();
  await context.setOffline(false);
});

test("updates require consent and protect other windows", async ({
  page,
  context,
}) => {
  const { readFile, writeFile } = await import("node:fs/promises");
  const original = await readFile("out/sw.js", "utf8");
  try {
    await page.goto("/");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller)
        await new Promise<void>((resolve) =>
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => resolve(),
            { once: true },
          ),
        );
    });
    const other = await context.newPage();
    await other.goto("/");
    await other.getByRole("button", { name: "Count: 0" }).click();
    await writeFile(
      "out/sw.js",
      original.replace("romdex-shell-", "romdex-shell-test-"),
    );
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
    });
    await expect(
      page.getByRole("button", { name: "Reload to update" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Reload to update" }).click();
    await expect(
      page.getByText(
        "Close other ROMDex windows, then choose Reload to update again.",
      ),
    ).toBeVisible();
    await expect(other.getByRole("button", { name: "Count: 1" })).toBeVisible();
    await other.close();
    await Promise.all([
      page.waitForEvent("load"),
      page.getByRole("button", { name: "Reload to update" }).click(),
    ]);
    await expect(
      page.getByRole("button", { name: "Reload to update" }),
    ).toHaveCount(0);
  } finally {
    await writeFile("out/sw.js", original);
  }
});
