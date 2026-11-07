import { expect, test, type Locator, type Page } from "@playwright/test";
import { structuralFixture } from "./structural-fixture";

// 3 fixture tasks plus 300 root siblings; only rows near the viewport are in the DOM.
test.use({ serviceWorkers: "block", viewport: { width: 1280, height: 800 } });
const EXTRA = 300;
const TOTAL = EXTRA + 3;
const bounds = async (locator: Locator) => {
  const rect = await locator.boundingBox();
  expect(rect).not.toBeNull();
  return rect!;
};
const row = (page: Page, id: string) => page.locator(`[data-row="${id}"]`);
const scroller = (page: Page) => page.locator(".table-scroll");
const toBottom = (page: Page) =>
  scroller(page).evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
const open = async (page: Page) => {
  const fixture = await structuralFixture(page, "normal", EXTRA);
  await page.getByRole("button", { name: "Expand All", exact: true }).click();
  await expect(page.locator(".work-footer span").first()).toHaveText(
    `${TOTAL} Visible / ${TOTAL} in View`,
  );
  return fixture;
};
// Adjacent rendered rows must touch: spacers stand in for exactly the rows they replace.
const tiling = (page: Page) =>
  page.locator("#rows").evaluate((body) => {
    const rows = [...(body as HTMLTableSectionElement).rows];
    let worst = 0;
    for (const [index, current] of rows.entries()) {
      const next = rows[index + 1];
      if (!next) break;
      const gap =
        next.getBoundingClientRect().top -
        current.getBoundingClientRect().bottom;
      worst = Math.max(worst, Math.abs(gap));
    }
    return worst;
  });

test("a long list mounts only nearby rows and still reports every row", async ({
  page,
}) => {
  await open(page);
  expect(await page.locator("[data-row]").count()).toBeLessThan(80);
  await expect(page.locator(".table-scroll table")).toHaveAttribute(
    "aria-rowcount",
    String(TOTAL + 1),
  );
  await expect(row(page, "PMON-900001")).toHaveAttribute("aria-rowindex", "2");
  await toBottom(page);
  const last = row(page, "PMON-" + (901000 + EXTRA - 1));
  await expect(last).toBeVisible();
  await expect(last).toHaveAttribute("aria-rowindex", String(TOTAL + 1));
  expect(await page.locator("[data-row]").count()).toBeLessThan(80);
  expect(await tiling(page)).toBeLessThan(1);
  await expect(row(page, "PMON-900001")).toHaveCount(0);
});

test("variable row heights are measured, so the end of the list lines up", async ({
  page,
}) => {
  await open(page);
  // Every seventh row is twice as tall as the estimate the spacers start from.
  await page.addStyleTag({
    content: '#rows tr[aria-rowindex$="7"]>td{height:90px}',
  });
  for (let step = 0; step < 40; step++) {
    await page.mouse.move(640, 500);
    await page.mouse.wheel(0, 400);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(resolve)),
    );
    expect(await tiling(page)).toBeLessThan(1);
  }
  await toBottom(page);
  const last = row(page, "PMON-" + (901000 + EXTRA - 1));
  await expect(last).toBeVisible();
  const area = await bounds(scroller(page));
  await expect
    .poll(async () => {
      const box = await bounds(last);
      return Math.round(area.y + area.height - (box.y + box.height));
    })
    .toBeLessThan(40);
  expect(await tiling(page)).toBeLessThan(1);
});

test("focus survives its row scrolling away and Tab continues to the next row", async ({
  page,
}) => {
  await open(page);
  const actions = row(page, "PMON-900002").locator("button:visible").last();
  await actions.focus();
  await toBottom(page);
  await expect(actions).toBeFocused();
  // The focused row stays in the DOM at its own place, between spacers.
  await expect(row(page, "PMON-900002")).toHaveAttribute("aria-rowindex", "4");
  await expect(row(page, "PMON-900002")).not.toBeInViewport();
  await page.keyboard.press("Tab");
  const landed = await page.evaluate(
    () =>
      document.activeElement?.closest<HTMLElement>("[data-row]")?.dataset.row,
  );
  expect(landed).toBe("PMON-901000");
  await expect(row(page, "PMON-901000")).toBeInViewport();
});

test("a drag can scroll to the far end of a long list and drop exactly there", async ({
  page,
}) => {
  const fixture = await open(page);
  const grip = row(page, "PMON-900002").locator(".grip");
  await grip.hover();
  const source = await bounds(grip);
  await page.mouse.move(source.x + 8, source.y + 10);
  await page.mouse.down();
  await page.mouse.move(source.x + 8, source.y + 40, { steps: 4 });
  // Scroll the table mid-drag, as a wheel or scrollbar would.
  await toBottom(page);
  const last = row(page, "PMON-" + (901000 + EXTRA - 1));
  await expect(last).toBeVisible();
  const target = await bounds(last);
  await page.keyboard.down("Shift");
  await page.mouse.move(source.x + 8, target.y + target.height - 6, {
    steps: 4,
  });
  await expect(page.locator(".work-footer [role=status]")).toContainText(
    "at end",
  );
  const guide = await bounds(page.locator(".drop-guide"));
  expect(Math.abs(guide.y + 1 - (target.y + target.height))).toBeLessThan(3);
  await page.mouse.up();
  await page.keyboard.up("Shift");
  const order = () =>
    page
      .locator("[data-row]")
      .evaluateAll((rows) =>
        rows.map((element) => (element as HTMLElement).dataset.row),
      );
  await expect.poll(async () => (await order()).at(-1)).toBe("PMON-900002");
  await expect(row(page, "PMON-900002")).toHaveAttribute(
    "aria-rowindex",
    String(TOTAL + 1),
  );
  expect(fixture.writes).toEqual([]);
});
