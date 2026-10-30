import { expect, type Page } from "@playwright/test";
// The desktop-style inline Enter flow leaves the next sibling draft open.
export const finishInlineTask = async (page: Page, title: string) => {
  const input = page.locator("#draft-title");
  await input.fill(title);
  await input.press("Enter");
  await expect(input).toHaveValue("");
  await input.press("Escape");
  await expect(input).toHaveCount(0);
  await page.locator(".row-title").filter({ hasText: title }).click();
};
