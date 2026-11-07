import { expect, test } from "@playwright/test";
import { addTask, structuralFixture } from "./structural-fixture";
import { storedSelection } from "./task-status";
test.use({ serviceWorkers: "block" });
// PMON-639 (owner answer Q7): a row click selects after 220 ms; Save pressed
// before then used to cancel that selection.
for (const wait of [0, 1000]) {
  test(`Save ${wait} ms after creating a task keeps it selected`, async ({
    page,
  }) => {
    const s = await structuralFixture(page);
    await s.connect();
    await addTask(page, "Selected Root");
    if (wait) await page.waitForTimeout(wait);
    await s.save();
    await s.confirmed();
    await expect.poll(() => storedSelection(page)).toMatch(/^PMON-/);
    await expect(
      page.getByRole("textbox", { name: "Task Title", exact: true }),
    ).toHaveValue("Selected Root");
  });
}
