import {test,expect} from "@playwright/test";
test("task notes and comment drafts survive switching, restart and offline reopening",async({page,context})=>{
  await page.goto("/");await page.getByRole("button",{name:"Add Epic",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Add Epic",exact:true});await dialog.getByLabel("Name",{exact:true}).fill("Synthetic Port Epic");await dialog.getByRole("button",{name:"Create Item"}).click();
  await page.getByRole("textbox",{name:"Notes and Instructions",exact:true}).fill("Durable synthetic notes");
  await page.getByRole("button",{name:"Comments 0",exact:true}).click();await page.getByRole("textbox",{name:"Write a Comment",exact:true}).fill("Unposted synthetic draft");
  await expect(page.getByRole("status").first()).toHaveText("All changes saved in this browser");
  await page.getByRole("button",{name:"Switch Workspace",exact:true}).click();await page.getByRole("menuitemradio",{name:"NPCDex",exact:true}).click();
  await page.getByRole("button",{name:"Switch Workspace",exact:true}).click();await page.getByRole("menuitemradio",{name:"ROMDex",exact:true}).click();
  await page.getByRole("button",{name:"Comments 0",exact:true}).click();await expect(page.getByRole("textbox",{name:"Write a Comment",exact:true})).toHaveValue("Unposted synthetic draft");
  await page.reload();await expect(page.getByRole("textbox",{name:"Notes and Instructions",exact:true})).toHaveValue("Durable synthetic notes");
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await context.setOffline(true);await page.reload();await expect(page.getByRole("textbox",{name:"Notes and Instructions",exact:true})).toHaveValue("Durable synthetic notes");await context.setOffline(false);
  await page.getByRole("button",{name:"Comments 0",exact:true}).click();await expect(page.getByRole("textbox",{name:"Write a Comment",exact:true})).toHaveValue("Unposted synthetic draft");
});
test("a stale second window cannot overwrite a newer browser save",async({page,context})=>{
  await page.goto("/");await page.getByRole("button",{name:"Add Epic",exact:true}).click();await page.getByRole("dialog").getByLabel("Name",{exact:true}).fill("Synthetic concurrent task");await page.getByRole("button",{name:"Create Item",exact:true}).click();await expect(page.getByRole("status").first()).toHaveText("All changes saved in this browser");
  const other=await context.newPage();await other.goto("/");await expect(other.getByRole("textbox",{name:"Notes and Instructions",exact:true})).toHaveValue("");
  await page.getByRole("textbox",{name:"Notes and Instructions",exact:true}).fill("First window saved");await expect(page.getByRole("status").first()).toHaveText("All changes saved in this browser");
  await other.getByRole("textbox",{name:"Notes and Instructions",exact:true}).fill("Second window recovery");await expect(other.getByRole("alert").filter({hasText:"Another ROMDex window saved first"})).toContainText("Another ROMDex window saved first");await expect(other.getByRole("button",{name:"Export Recovery Copy",exact:true})).toBeEnabled();
  await page.reload();await expect(page.getByRole("textbox",{name:"Notes and Instructions",exact:true})).toHaveValue("First window saved");
});
test.describe("direct reader without a worker", () => { test.use({serviceWorkers:"block"});
test("YouTrack read uses only direct GET and never persists the token",async({page})=>{
  const requests:string[]=[];
  await page.route("https://thegobindsingh.youtrack.cloud/api/**",async route=>{if(route.request().method()!=="OPTIONS") requests.push(route.request().method());await route.fulfill({headers:{"access-control-allow-origin":"*","access-control-allow-headers":"authorization,accept","access-control-allow-methods":"GET, OPTIONS"},contentType:"application/json",body:JSON.stringify([{id:"2-test",idReadable:"PMON-900001",summary:"Synthetic remote task",description:"Fixture only",updated:1,project:{shortName:"PMON"},parent:{issues:[]},customFields:[],commentsCount:0}])});});
  await page.goto("/");await page.getByRole("button",{name:"Connection Details",exact:true}).click();await page.getByLabel("YouTrack Permanent Token",{exact:true}).fill("fixture-token-never-persist");await page.getByRole("button",{name:"Read YouTrack Tasks",exact:true}).click();await page.getByRole("button",{name:"Save 1 Tasks in This Browser",exact:true}).click();
  await expect(page.getByRole("button",{name:"Synthetic remote task",exact:true}).last()).toBeVisible();await expect(page.getByRole("status").first()).toHaveText("All changes saved in this browser");expect(requests).toEqual(["GET"]);
  const stored=await page.evaluate(async()=>new Promise<string>((resolve,reject)=>{const request=indexedDB.open("romdex-web-workspace",1);request.onsuccess=()=>{const db=request.result;const get=db.transaction("workspace").objectStore("workspace").get("current");get.onsuccess=()=>{resolve(JSON.stringify(get.result));db.close();};get.onerror=()=>reject(Error("Read failed"));};request.onerror=()=>reject(Error("Open failed"));}));expect(stored).not.toContain("fixture-token-never-persist");
});

});

test("desktop hierarchy stays beside the work panes",async({page})=>{
  test.skip((page.viewportSize()?.width??0)<1100,"Desktop geometry");
  await page.goto("/");
  const sidebar=await page.getByRole("complementary",{name:"Project Hierarchy",exact:true}).boundingBox();
  const work=await page.getByRole("main",{name:"Work and Details Trays",exact:true}).boundingBox();
  expect(sidebar).not.toBeNull();expect(work).not.toBeNull();
  if(!sidebar||!work)throw Error("Workspace panes are missing");
  expect(sidebar.x+sidebar.width).toBeLessThanOrEqual(work.x);
  expect(Math.abs(sidebar.y-work.y)).toBeLessThan(2);
});

test("Awaiting Testing follows development, flashes amber, survives reload and respects reduced motion",async({page})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});await page.goto("/");await page.getByRole("button",{name:"Add Epic",exact:true}).click();await page.getByRole("dialog").getByLabel("Name",{exact:true}).fill("Synthetic amber task");await page.getByRole("button",{name:"Create Item",exact:true}).click();
  const picker=page.getByRole("combobox",{name:"Assigned Status",exact:true});const options=await picker.locator("option").allTextContents();expect(options[options.indexOf("In Development")+1]).toBe("Awaiting Testing");await picker.selectOption("Awaiting Testing");
  const lamp=page.getByRole("img",{name:"Awaiting Testing",exact:true}).first();await expect(lamp).toBeVisible();await expect(lamp).toHaveClass("bulb amber");expect(await lamp.evaluate(el=>getComputedStyle(el,"::after").animationName)).toBe("indicator-amber-blink");
  await expect(page.getByRole("status").first()).toHaveText("All changes saved in this browser");await page.reload();await expect(picker).toHaveValue("Awaiting Testing");await page.emulateMedia({reducedMotion:"reduce"});expect(await lamp.evaluate(el=>getComputedStyle(el,"::after").animationName)).toBe("none");expect(await lamp.evaluate(el=>getComputedStyle(el,"::after").backgroundColor)).toBe("rgb(245, 166, 35)");
});
