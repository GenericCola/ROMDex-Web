import { finishInlineTask } from "./inline-task";
import {test,expect} from "@playwright/test";
import {readFile,writeFile} from "node:fs/promises";
import {openLocalWorkspace,routeLocalWorkspace,savedLocally} from "./local-workspace";
test("task drafts survive a blocked update and the consenting reload",async({page,context})=>{
  const original=await readFile("out/sw.js","utf8");
  try {
    await routeLocalWorkspace(context);await openLocalWorkspace(page);await page.getByRole("button",{name:"Add Epic",exact:true}).click();
    await finishInlineTask(page, "Synthetic update task");
    await page.getByRole("textbox",{name:"Notes and Instructions",exact:true}).fill("Draft retained across update");
    await savedLocally(page,"Draft retained across update");
    await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener("controllerchange",()=>resolve(),{once:true}));});
    // A second window only shows the one-window notice, but still counts as an open window.
    const other=await context.newPage();await other.goto("/");await expect(other.getByRole("heading",{name:"ROMDex is open in another window",exact:true})).toBeVisible();
        await writeFile("out/sw.js",original.replace("romdex-shell-","romdex-shell-task-test-"));
    await page.getByRole("button",{name:"TOOLS",exact:true}).click();await page.getByRole("button",{name:"CHECK FOR UPDATES",exact:true}).click();
    const updates=page.getByRole("dialog",{name:"Check for updates",exact:true});await updates.getByRole("button",{name:"Apply update",exact:true}).click();
    await expect(updates.getByText("Close other ROMDex windows, then try applying the update again.",{exact:true})).toBeVisible();await updates.getByRole("button",{name:"Close Check for updates",exact:true}).click();
    await expect(page.getByRole("textbox",{name:"Notes and Instructions",exact:true})).toBeEditable();
    await other.close();
    await Promise.all([page.waitForEvent("load"),page.getByRole("button",{name:"TOOLS",exact:true}).click().then(()=>page.getByRole("button",{name:"CHECK FOR UPDATES",exact:true}).click()).then(()=>page.getByRole("button",{name:"Apply update",exact:true}).click())]);
    await expect(page.getByRole("textbox",{name:"Notes and Instructions",exact:true})).toHaveValue("Draft retained across update");
  } finally {await writeFile("out/sw.js",original);}
});
