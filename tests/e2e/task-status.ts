import { expect, type Page } from "@playwright/test";
// Status lives in the "Set Status" popup; the row and the details pane share its button, so use the details pane copy.
export const statusButton = (page: Page, summary: string) => page.locator("#details").getByRole("button", { name: "Set Status for " + summary, exact: true });
const popup = (page: Page) => page.getByRole("dialog", { name: "Set Status", exact: true });
export const setStatus = async (page: Page, summary: string, status: string) => {
  await statusButton(page, summary).click();
  await popup(page).getByRole("button", { name: status, exact: true }).click();
  await expect(popup(page)).toHaveCount(0);
};
export const assignedStatus = async (page: Page, summary: string) => {
  await statusButton(page, summary).click();
  const pressed = popup(page).getByRole("button", { pressed: true });
  await expect(pressed).toHaveCount(1);
  const status = (await pressed.getAttribute("aria-label")) ?? "";
  await popup(page).getByRole("button", { name: "Close Set Status", exact: true }).click();
  await expect(popup(page)).toHaveCount(0);
  return status;
};
export const expectAssigned = async (page: Page, summary: string, status: string) => {
  await statusButton(page, summary).click();
  await expect(popup(page).getByRole("button", { name: status, exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(popup(page).getByRole("button", { pressed: true })).toHaveCount(1);
  await popup(page).getByRole("button", { name: "Close Set Status", exact: true }).click();
  await expect(popup(page)).toHaveCount(0);
};
// A single click on a row title opens the task after a short delay so a double-click can rename
// instead, and any later pointerdown cancels it. Wait for the details pane before the next click.
export const selectTask = async (page: Page, summary: string) => {
  await page.getByRole("button", { name: summary, exact: true }).last().click();
  await expect(page.getByRole("textbox", { name: "Task Title", exact: true })).toHaveValue(summary);
};
// The exact-destination dialog opened by the row grip replaces the old "Task Parent" select.
export const moveTask = async (page: Page, summary: string, parentId: string) => {
  await page.getByRole("button", { name: "Drag " + summary, exact: true }).last().click();
  const dialog = page.getByRole("dialog", { name: "Move " + summary, exact: true });
  await dialog.getByLabel("Destination parent").selectOption(parentId);
  await dialog.getByRole("button", { name: "Move Task", exact: true }).click();
  await expect(dialog).toHaveCount(0);
};
// Selection is persisted after a short delay; poll the stored copy before Save, reload or a storage fault.
export const storedSelection=(page:Page)=>page.evaluate(async key=>new Promise<string|null>((resolve,reject)=>{const open=indexedDB.open("romdex-web-workspace",1);open.onerror=()=>{reject(Error("Open failed"));};open.onsuccess=()=>{const get=open.result.transaction("workspace").objectStore("workspace").get(key);get.onerror=()=>{reject(Error("Read failed"));};get.onsuccess=()=>{open.result.close();resolve((get.result as {data?:{view?:{selected?:string|null}}}|undefined)?.data?.view?.selected??null);};};}),JSON.stringify(["youtrack","https://thegobindsingh.youtrack.cloud","fixture-owner","0-1"]));
