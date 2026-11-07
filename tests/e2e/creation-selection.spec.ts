import { expect, test } from "@playwright/test";
import { addTask, structuralFixture } from "./structural-fixture";
import { storedSelection } from "./task-status";
test.use({ serviceWorkers: "block" });
for (const wait of [0, 1000]) {
  test(`Save ${wait} ms after creating a task keeps it selected`, async ({
    page,
  }) => {
    const s = await structuralFixture(page);
    await addTask(page, "Selected Root");
    await s.connect();
    if (wait) await page.waitForTimeout(wait);
    await s.save();
    await s.confirmed();
    await expect.poll(() => storedSelection(page)).toMatch(/^PMON-/);
    await expect(
      page.getByRole("textbox", { name: "Task Title", exact: true }),
    ).toHaveValue("Selected Root");
  });
}
