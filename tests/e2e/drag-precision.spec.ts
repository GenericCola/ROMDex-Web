import { expect, test, type Locator } from "@playwright/test";
import { structuralFixture } from "./structural-fixture";

test.use({ serviceWorkers: "block", viewport: { width: 1280, height: 800 } });
const bounds = async (locator: Locator) => {
  const rect = await locator.boundingBox();
  expect(rect).not.toBeNull();
  return rect!;
};
const row = (page: import("@playwright/test").Page, id: number) =>
  page.locator(`[data-row="PMON-${id}"]`);
const order = (page: import("@playwright/test").Page) =>
  page
    .locator("[data-row]")
    .evaluateAll((rows) => rows.map((row) => (row as HTMLElement).dataset.row));

test("title drag shows exact destination, expands a collapsed parent and commits its displayed boundary", async ({
  page,
}) => {
  const fixture = await structuralFixture(page);
  await page.getByRole("button", { name: "Collapse All", exact: true }).click();
  const source = await bounds(row(page, 900002).locator(".row-title"));
  const target = await bounds(row(page, 900001));
  await page.mouse.move(source.x + 10, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + 40, target.y + target.height / 2, {
    steps: 8,
  });
  await expect(page.locator(".work-footer [role=status]")).toContainText(
    "Under Fixture Root",
  );
  await expect(row(page, 900003)).toBeVisible();
  const guide = page.locator(".drop-guide");
  await expect(guide).toBeVisible();
  await expect
    .poll(async () => {
      const g = await bounds(guide),
        child = await bounds(row(page, 900003));
      return Math.abs(g.y + 1 - (child.y + child.height));
    })
    .toBeLessThan(3);
  await page.screenshot({
    path: `artifacts/drag-precision/${test.info().project.name}-nested-guide.png`,
  });
  await page.mouse.up();
  await expect(row(page, 900002)).toHaveAttribute("style", /--depth: 1/);
  await expect
    .poll(() => order(page))
    .toEqual(["PMON-900001", "PMON-900003", "PMON-900002"]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(fixture.writes).toEqual([]);
});

test("exact move is keyboard accessible, places before a child, persists and returns to root", async ({
  page,
}) => {
  await structuralFixture(page);
  const grip = page.getByRole("button", {
    name: "Drag Fixture Other",
    exact: true,
  });
  await grip.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", {
    name: "Move Fixture Other",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Find destination").fill("Fixture Root");
  await dialog.getByLabel("Destination parent").selectOption("PMON-900001");
  await dialog.getByLabel("Position").selectOption("PMON-900003");
  await page.screenshot({
    path: `artifacts/drag-precision/${test.info().project.name}-exact-move.png`,
  });
  await dialog.getByRole("button", { name: "Move Task", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(() => order(page))
    .toEqual(["PMON-900001", "PMON-900002", "PMON-900003"]);
  await expect(row(page, 900002)).toHaveAttribute("style", /--depth: 1/);
  await page.reload();
  await expect(row(page, 900002)).toHaveAttribute("style", /--depth: 1/);
  await grip.click();
  await dialog.getByLabel("Destination parent").selectOption("");
  await dialog.getByRole("button", { name: "Move Task", exact: true }).click();
  await expect(row(page, 900002)).toHaveAttribute("style", /--depth: 0/);
  await grip.click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(grip).toBeFocused();
});

test("stationary Shift changes the displayed level and Escape suppresses the release click", async ({
  page,
}) => {
  await structuralFixture(page);
  const source = await bounds(row(page, 900002).locator(".grip"));
  const target = await bounds(row(page, 900001));
  await page.mouse.move(source.x + 8, source.y + 10);
  await page.mouse.down();
  await page.mouse.move(source.x + 40, target.y + 4, { steps: 5 });
  const status = page.locator(".work-footer [role=status]");
  await expect(status).toContainText("Under Fixture Root");
  await page.keyboard.down("Shift");
  await expect(status).toContainText("Under All Tasks");
  await expect(status).toContainText("before Fixture Root");
  await page.keyboard.up("Shift");
  await expect(status).toContainText("Under Fixture Root");
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator(".drop-guide")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(row(page, 900002)).toHaveAttribute("style", /--depth: 0/);
});

test("a stationary edge drag continues scrolling and cancellation stops it", async ({
  page,
}) => {
  await structuralFixture(page, "normal", 70);
  const scroller = page.locator(".table-scroll");
  const source = await bounds(row(page, 900001).locator(".grip"));
  const area = await bounds(scroller);
  await page.mouse.move(source.x + 8, source.y + 10);
  await page.mouse.down();
  await page.mouse.move(source.x + 8, area.y + area.height - 8, { steps: 8 });
  const scrollTop = () => scroller.evaluate((element) => element.scrollTop);
  await expect.poll(scrollTop).toBeGreaterThan(36);
  const first = await scrollTop();
  await expect.poll(scrollTop).toBeGreaterThan(first + 24);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  const stopped = await scrollTop();
  await page.waitForTimeout(200);
  expect(await scrollTop()).toBe(stopped);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("ordinary title click and rename remain usable after enabling title dragging", async ({
  page,
}) => {
  await structuralFixture(page);
  const title = row(page, 900002).locator(".row-title");
  await title.click();
  await expect(
    page.getByRole("textbox", { name: "Task Title", exact: true }),
  ).toHaveValue("Fixture Other");
  await title.dblclick();
  await expect(
    page.getByRole("textbox", { name: "Rename Task", exact: true }),
  ).toHaveValue("Fixture Other");
  await page.keyboard.press("Escape");
  await expect(title).toBeVisible();
});

test("exact placement flushes notes and scoped drag guides use relative depth", async ({
  page,
}) => {
  await structuralFixture(page);
  await row(page, 900002).locator(".row-title").click();
  const notes = page.getByRole("textbox", {
    name: "Notes and Instructions",
    exact: true,
  });
  await notes.fill("Unsaved synthetic note survives exact placement.");
  await page
    .getByRole("button", { name: "Drag Fixture Other", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Move Fixture Other",
    exact: true,
  });
  await dialog.getByLabel("Destination parent").selectOption("PMON-900001");
  await dialog.getByRole("button", { name: "Move Task", exact: true }).click();
  await expect(notes).toHaveValue(
    "Unsaved synthetic note survives exact placement.",
  );
  await page.reload();
  await row(page, 900002).locator(".row-title").click();
  await expect(notes).toHaveValue(
    "Unsaved synthetic note survives exact placement.",
  );
  await page.locator('.selector-main[data-select="PMON-900001"]').click();
  await expect(
    page.locator('.selector-main[data-select="PMON-900001"]'),
  ).toHaveAttribute("aria-current", "true");
  await expect(row(page, 900001)).toHaveCount(0);
  await row(page, 900003).scrollIntoViewIfNeeded();
  const source = await bounds(row(page, 900002).locator(".grip"));
  const child = await bounds(row(page, 900003));
  await page.mouse.move(source.x + 8, source.y + 10);
  await page.mouse.down();
  await page.keyboard.down("Shift");
  await page.mouse.move(source.x + 8, child.y + 4, { steps: 5 });
  console.log("ROMDEX_SCOPED_POINTER", await page.evaluate(({ x, y }) => ({
    x, y, hit: document.elementFromPoint(x, y)?.outerHTML.slice(0, 800),
    rows: [...document.querySelectorAll("[data-row]")].map(e => ({ id: e.getAttribute("data-row"), box: e.getBoundingClientRect().toJSON() })),
    head: document.querySelector("thead")?.getBoundingClientRect().toJSON(),
    scroll: document.querySelector(".table-scroll")?.scrollTop,
    status: document.querySelector(".work-footer [role=status]")?.textContent,
  }), { x: source.x + 8, y: child.y + 4 }));
  await expect(page.locator(".work-footer [role=status]")).toContainText(
    "before Fixture Child",
  );
  const guide = await bounds(page.locator(".drop-guide"));
  const hierarchy = await bounds(row(page, 900003).locator(".row-hierarchy"));
  expect(Math.abs(guide.x - hierarchy.x)).toBeLessThan(2);
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await expect.poll(() => order(page)).toEqual(["PMON-900002", "PMON-900003"]);
});

test("checked siblings retain order when moved together", async ({ page }) => {
  await structuralFixture(page, "normal", 2);
  await page
    .getByRole("checkbox", { name: "Select Fixture Other", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Select Scroll fixture 0", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Select Fixture Other", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", {
      name: "Select Scroll fixture 0",
      exact: true,
    }),
  ).toBeChecked();
  const source = await bounds(row(page, 900002).locator(".grip"));
  const target = await bounds(row(page, 900001));
  await page.mouse.move(source.x + 8, source.y + 10);
  await page.mouse.down();
  await page.keyboard.down("Shift");
  await page.mouse.move(source.x + 8, target.y + 4, { steps: 5 });
  console.log("ROMDEX_BULK_POINTER", await page.evaluate(({ x, y }) => ({
    x, y, hit: document.elementFromPoint(x, y)?.outerHTML.slice(0, 800),
    rows: [...document.querySelectorAll("[data-row]")].map(e => ({ id: e.getAttribute("data-row"), box: e.getBoundingClientRect().toJSON() })),
    head: document.querySelector("thead")?.getBoundingClientRect().toJSON(),
    scroll: document.querySelector(".table-scroll")?.scrollTop,
    status: document.querySelector(".work-footer [role=status]")?.textContent,
  }), { x: source.x + 8, y: target.y + 4 }));
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await expect
    .poll(async () => (await order(page)).slice(0, 3))
    .toEqual(["PMON-900002", "PMON-901000", "PMON-900001"]);
  await expect(
    page.getByRole("checkbox", { name: "Select Fixture Other", exact: true }),
  ).not.toBeChecked();
});
