import { finishInlineTask } from "./inline-task";
import {test,expect} from "@playwright/test";
import {expectAssigned} from "./task-status";
import {openLocalWorkspace,routeLocalWorkspace,savedLocally,stored} from "./local-workspace";
test("task notes and comment drafts survive switching, restart and offline reopening",async({page,context})=>{
  await routeLocalWorkspace(context);await openLocalWorkspace(page);await page.getByRole("button",{name:"Add Epic",exact:true}).click();
  await finishInlineTask(page, "Synthetic Port Epic");
  await page.getByRole("textbox",{name:"Notes and Instructions",exact:true}).fill("Durable synthetic notes");
  await page.getByRole("button",{name:"Comments",exact:true}).click();await page.getByRole("textbox",{name:"Write a Comment",exact:true}).fill("Unposted synthetic draft");
  await savedLocally(page,"Unposted synthetic draft");
  await page.getByRole("button",{name:"Switch Workspace",exact:true}).click();await page.getByRole("menuitemradio",{name:"NPCDex",exact:true}).click();
  await page.getByRole("button",{name:"Switch Workspace",exact:true}).click();await page.getByRole("menuitemradio",{name:"ROMDex",exact:true}).click();
  await page.getByRole("button",{name:"Comments",exact:true}).click();await expect(page.getByRole("textbox",{name:"Write a Comment",exact:true})).toHaveValue("Unposted synthetic draft");
  await page.reload();await expect(page.getByRole("textbox",{name:"Notes and Instructions",exact:true})).toHaveValue("Durable synthetic notes");
  // Offline means no session answer either: drop the fixture routes (they would still answer)
  // so the worker serves the shell.
  // The app opens the remembered workspace offline and reconnects on `online` (PMON-628).
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await context.unrouteAll({behavior:"wait"});await context.setOffline(true);await page.reload();await expect(page.getByRole("textbox",{name:"Notes and Instructions",exact:true})).toHaveValue("Durable synthetic notes");
  const offline=page.getByText("Offline: changes are saved here and sent when you are back online",{exact:true});await expect(offline).toBeVisible();
  await routeLocalWorkspace(context);await context.setOffline(false);await expect(offline).toBeHidden();
  await page.getByRole("button",{name:"Comments",exact:true}).click();await expect(page.getByRole("textbox",{name:"Write a Comment",exact:true})).toHaveValue("Unposted synthetic draft");
});
test("a second window waits for Use here, then takes over with the newest save",async({page,context})=>{
  const notes=(target:typeof page)=>target.getByRole("textbox",{name:"Notes and Instructions",exact:true});
  const notice=(target:typeof page)=>target.getByRole("heading",{name:"ROMDex is open in another window",exact:true});
  await routeLocalWorkspace(context);await openLocalWorkspace(page);await page.getByRole("button",{name:"Add Epic",exact:true}).click();await finishInlineTask(page, "Synthetic concurrent task");await savedLocally(page,"Synthetic concurrent task");
  await notes(page).fill("First window saved");await savedLocally(page,"First window saved");
  const other=await context.newPage();await other.goto("/");await expect(notice(other)).toBeVisible();await expect(other.getByRole("button",{name:/^Save Changes/})).toHaveCount(0);
  await other.getByRole("button",{name:"Use here",exact:true}).click();await expect(notice(page)).toBeVisible();await expect(page.getByRole("button",{name:/^Save Changes/})).toHaveCount(0);
  await expect(notes(other)).toHaveValue("First window saved");await notes(other).fill("Second window saved");await savedLocally(other,"Second window saved");
  await page.getByRole("button",{name:"Use here",exact:true}).click();await expect(notice(other)).toBeVisible();await expect(notes(page)).toHaveValue("Second window saved");
});
test.describe("signed-in reader without a worker", () => { test.use({serviceWorkers:"block"});
test("YouTrack read uses only GET through the signed-in session and never persists the session secret",async({page,context})=>{
  const csrf="fixture-csrf-never-persist",methods:string[]=[];
  await routeLocalWorkspace(context,{csrf,issues:[{id:"2-test",idReadable:"PMON-900001",summary:"Synthetic remote task",description:"Fixture only",updated:1,project:{id:"0-1",shortName:"PMON"},parent:{issues:[]},customFields:["Type","State","Priority","Complexity"].map((name,i)=>({id:"92-"+i,name,$type:name==="State"?"StateIssueCustomField":"SingleEnumIssueCustomField",value:{name:{Type:"Task",State:"To do",Priority:"Normal",Complexity:"Low"}[name]}})),commentsCount:0,comments:[]}]});
  page.on("request",request=>{if(new URL(request.url()).pathname==="/api/youtrack")methods.push(request.method());});
  await openLocalWorkspace(page);await page.getByRole("button",{name:/^Connection Details/}).click();await page.getByRole("button",{name:"Read YouTrack Tasks",exact:true}).click();await page.getByRole("button",{name:"Save 1 Tasks in This Browser",exact:true}).click();
  await expect(page.getByRole("button",{name:"Synthetic remote task",exact:true}).last()).toBeVisible();await savedLocally(page,"Synthetic remote task");expect(new Set(methods)).toEqual(new Set(["GET"]));
  expect(await stored(page)).not.toContain(csrf);
  expect(await page.evaluate(()=>JSON.stringify([{...localStorage},{...sessionStorage}]))).not.toContain(csrf);
});

});

test("desktop hierarchy stays beside the work panes",async({page,context})=>{
  test.skip((page.viewportSize()?.width??0)<1100,"Desktop geometry");
  await routeLocalWorkspace(context);await openLocalWorkspace(page);
  const sidebar=await page.getByRole("complementary",{name:"Project Hierarchy",exact:true}).boundingBox();
  const work=await page.getByRole("main",{name:"Work and Details Trays",exact:true}).boundingBox();
  expect(sidebar).not.toBeNull();expect(work).not.toBeNull();
  if(!sidebar||!work)throw Error("Workspace panes are missing");
  expect(sidebar.x+sidebar.width).toBeLessThanOrEqual(work.x);
  expect(Math.abs(sidebar.y-work.y)).toBeLessThan(2);
});

test("Awaiting Testing follows development, flashes amber, survives reload and respects reduced motion",async({page,context})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});await routeLocalWorkspace(context);await openLocalWorkspace(page);await page.getByRole("button",{name:"Add Epic",exact:true}).click();await finishInlineTask(page, "Synthetic amber task");
  await page.locator("#details").getByRole("button",{name:"Set Status for Synthetic amber task",exact:true}).click();const popup=page.getByRole("dialog",{name:"Set Status",exact:true});const options=await popup.locator(".status-options button").evaluateAll(buttons=>buttons.map(button=>button.getAttribute("aria-label")));expect(options[options.indexOf("In Development")+1]).toBe("Awaiting Testing");await popup.getByRole("button",{name:"Awaiting Testing",exact:true}).click();await expect(popup).toHaveCount(0);
  const lamp=page.getByRole("img",{name:"Awaiting Testing",exact:true}).first();await expect(lamp).toBeVisible();await expect(lamp).toHaveClass("bulb amber");expect(await lamp.evaluate(el=>getComputedStyle(el,"::after").animationName)).toBe("indicator-amber-blink");
  await savedLocally(page,"Awaiting Testing");await page.reload();await expectAssigned(page,"Synthetic amber task","Awaiting Testing");await page.emulateMedia({reducedMotion:"reduce"});const reloaded=page.getByRole("img",{name:"Awaiting Testing",exact:true}).first();expect(await reloaded.evaluate(el=>getComputedStyle(el,"::after").animationName)).toBe("none");expect(await reloaded.evaluate(el=>getComputedStyle(el,"::after").backgroundColor)).toBe("rgb(245, 166, 35)");
});
