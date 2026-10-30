import { finishInlineTask } from "./inline-task";
import {test,expect} from "@playwright/test";
import {readFile,writeFile} from "node:fs/promises";
test("task drafts survive a blocked update and the consenting reload",async({page,context})=>{
  const original=await readFile("out/sw.js","utf8");
  try {
    await page.goto("/");await page.getByRole("button",{name:"Add Epic",exact:true}).click();
    await finishInlineTask(page, "Synthetic update task");
    await page.getByRole("textbox",{name:"Notes and Instructions",exact:true}).fill("Draft retained across update");
    await expect(page.getByRole("status").first()).toHaveText("All changes saved in this browser");
    await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener("controllerchange",()=>resolve(),{once:true}));});
    const other=await context.newPage();await other.goto("/");await expect(other.getByRole("textbox",{name:"Notes and Instructions",exact:true})).toHaveValue("Draft retained across update");
    await page.getByText("Web port status and updates",{exact:true}).click();
    await writeFile("out/sw.js",original.replace("romdex-shell-","romdex-shell-task-test-"));
    await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration())?.update();});
    await page.getByRole("button",{name:"Reload to update",exact:true}).click();
    await expect(page.getByText("Close other ROMDex windows, then choose Reload to update again.")).toBeVisible();
    await expect(page.getByRole("textbox",{name:"Notes and Instructions",exact:true})).toBeEditable();
    await other.close();
    await Promise.all([page.waitForEvent("load"),page.getByRole("button",{name:"Reload to update",exact:true}).click()]);
    await expect(page.getByRole("textbox",{name:"Notes and Instructions",exact:true})).toHaveValue("Draft retained across update");
  } finally {await writeFile("out/sw.js",original);}
});
