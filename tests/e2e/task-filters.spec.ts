import { finishInlineTask } from "./inline-task";
import {test,expect,type Page} from "@playwright/test";
import {installCookieFixture,openCookieFixture,routeYouTrack} from "./cookie-fixture";
import {setStatus} from "./task-status";
test.use({serviceWorkers:"block"});
const fields=["Type","State","Priority","Complexity"];
// Signed-in project with the given issues; local drafts are never delivered in these specs.
const openProject=async(page:Page,issues:object[]=[])=>{
 await installCookieFixture(page);
 await routeYouTrack(page,"https://thegobindsingh.youtrack.cloud/api/**",async route=>{
  const path=new URL(route.request().url()).pathname,reply=(body:unknown)=>route.fulfill({contentType:"application/json",body:JSON.stringify(body)});
  if(path==="/api/articles")return reply([]);
  if(path==="/api/users/me")return reply({id:"fixture-owner"});
  if(path==="/api/admin/projects")return reply([{id:"0-1",shortName:"PMON"}]);
  if(path==="/api/admin/projects/0-1/customFields")return reply(fields.map((name,i)=>({id:"92-"+i,field:{name,fieldType:{id:name==="State"?"state[1]":"enum[1]"}}})));
  if(path==="/api/issues")return reply(issues);
  if(path.endsWith("/attachments"))return reply([]);
  throw Error("Unexpected filter fixture request "+path);
 });
 await openCookieFixture(page);
};
const field=(page:Page,name:"priority"|"complexity",summary:string)=>page.locator("#details").getByLabel(name+" for "+summary,{exact:true});
test("filter popup strictly narrows rows, combines fields and clears",async({page})=>{
 await openProject(page);
 async function add(name:string,parent=false){await page.getByRole("button",{name:parent?"Add child to Parent fixture":"Add Epic",exact:true}).click();await finishInlineTask(page, name);}
 await add("Parent fixture");await add("Testing child fixture",true);await setStatus(page,"Testing child fixture","Awaiting Testing");await field(page,"priority","Testing child fixture").selectOption("Major");await field(page,"complexity","Testing child fixture").selectOption("HIGH");await add("Done fixture");await setStatus(page,"Done fixture","Complete");
 await page.getByRole("button",{name:"Expand All",exact:true}).click();
 const button=page.getByRole("button",{name:"Filters",exact:true}),rows=page.locator("tbody .task-row");await button.click();
 const dialog=page.getByRole("dialog",{name:"Filters",exact:true});await expect(dialog).toBeVisible();await dialog.getByLabel("Filter Status",{exact:true}).selectOption("amber");await expect(rows).toHaveCount(2);await expect(rows).toContainText(["Parent fixture","Testing child fixture"]);await expect(button).toHaveAttribute("aria-pressed","true");expect(await button.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe("rgb(129, 199, 154)");
 await dialog.getByLabel("Filter Priority",{exact:true}).selectOption("Major");await dialog.getByLabel("Filter Complexity",{exact:true}).selectOption("HIGH");await dialog.getByLabel("Filter Assignee",{exact:true}).selectOption("__unassigned");await expect(rows).toHaveCount(1);await expect(rows.first()).toContainText("Testing child fixture");
 await page.screenshot({path:"artifacts/task-filter-"+test.info().project.name+".png"});
 const clear=dialog.getByRole("button",{name:"Clear All",exact:true}),close=dialog.getByRole("button",{name:"Close",exact:true});const a=await clear.boundingBox(),b=await close.boundingBox();expect(a&&b&&a.x>b.x).toBeTruthy();
 await clear.click();await expect(button).toHaveAttribute("aria-pressed","false");await dialog.getByLabel("Filter Status",{exact:true}).selectOption("green");await dialog.getByRole("button",{name:"Close",exact:true}).click();await page.getByRole("button",{name:"Hide Completed",exact:true}).click();await expect(rows).toHaveCount(1);await expect(rows.first()).toContainText("Done fixture");
 await page.getByRole("searchbox",{name:"Search This View",exact:true}).fill("no such task");await expect(rows).toHaveCount(0);await expect(page.locator(".empty h3")).toHaveText("No Matching Items");
 await button.click();await dialog.getByRole("button",{name:"Clear All",exact:true}).click();await expect(page.getByRole("searchbox",{name:"Search This View",exact:true})).toHaveValue("no such task");await page.keyboard.press("Escape");await expect(dialog).not.toBeVisible();await expect(button).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test.describe("assigned filters with signed-in reads",()=>{test.use({serviceWorkers:"block"});
test("Assignee filter uses imported single and multi-user identities and combines with status",async({page})=>{
 await openProject(page,["Alex","Blair"].map((name,index)=>({id:"2-"+index,idReadable:"PMON-"+(900001+index),summary:name+" task",description:"Synthetic only",updated:1,project:{id:"0-1",shortName:"PMON"},parent:{issues:[]},customFields:[{name:"Assignee",value:index?[{id:"1-b",login:"blair",fullName:"Blair"}]:{id:"1-a",login:"alex",fullName:"Alex"}},{name:"State",$type:"StateIssueCustomField",value:{name:index?"Done":"Needs Testing"}}],commentsCount:0,comments:[]})));
 await page.getByRole("button",{name:"Filters",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Filters",exact:true}),rows=page.locator("tbody .task-row");await dialog.getByLabel("Filter Assignee",{exact:true}).selectOption("1-a");await dialog.getByLabel("Filter Status",{exact:true}).selectOption("amber");await expect(rows).toHaveCount(1);await expect(rows.first()).toContainText("Alex task");await dialog.getByLabel("Filter Status",{exact:true}).selectOption("green");await expect(rows).toHaveCount(0);await dialog.getByLabel("Filter Assignee",{exact:true}).selectOption("1-b");await expect(rows).toHaveCount(1);await expect(rows.first()).toContainText("Blair task");
});});

test("active filters preserve parent toggles, Expand All and Collapse All with search and hidden ancestors",async({page})=>{
 await openProject(page);await page.getByRole("button",{name:"Add Epic",exact:true}).click();await finishInlineTask(page, "Expansion parent");await page.getByRole("button",{name:"Add child to Expansion parent",exact:true}).click();await finishInlineTask(page, "Expansion child");await setStatus(page,"Expansion child","Awaiting Testing");await field(page,"priority","Expansion child").selectOption("Major");await page.getByRole("button",{name:"Collapse All",exact:true}).click();
 const rows=page.locator("tbody .task-row"),filter=page.getByRole("button",{name:"Filters",exact:true}),dialog=page.getByRole("dialog",{name:"Filters",exact:true});await filter.click();await dialog.getByLabel("Filter Status",{exact:true}).selectOption("amber");await dialog.getByRole("button",{name:"Close",exact:true}).click();await expect(rows).toHaveCount(1);
 const expand=()=>page.getByRole("region",{name:"Task List",exact:true}).getByRole("button",{name:"Expand Expansion parent",exact:true}),collapse=()=>page.getByRole("region",{name:"Task List",exact:true}).getByRole("button",{name:"Collapse Expansion parent",exact:true});await expand().click();await expect(rows).toHaveCount(2);await expect(collapse()).toHaveAttribute("aria-expanded","true");await collapse().click();await expect(rows).toHaveCount(1);await expect(expand()).toHaveAttribute("aria-expanded","false");
 await page.getByRole("button",{name:"Expand All",exact:true}).click();await expect(rows).toHaveCount(2);await page.getByRole("button",{name:"Collapse All",exact:true}).click();await expect(rows).toHaveCount(1);
 await page.getByRole("searchbox",{name:"Search This View",exact:true}).fill("Expansion");await expect(rows).toHaveCount(1);await expand().click();await expect(rows).toHaveCount(2);await collapse().click();await expect(rows).toHaveCount(1);
 await filter.click();await dialog.getByLabel("Filter Priority",{exact:true}).selectOption("Major");await dialog.getByRole("button",{name:"Close",exact:true}).click();await expect(rows).toHaveCount(1);await expect(rows.first()).toContainText("Expansion child");
 await filter.click();await dialog.getByRole("button",{name:"Clear All",exact:true}).click();await dialog.getByRole("button",{name:"Close",exact:true}).click();await page.getByRole("searchbox",{name:"Search This View",exact:true}).fill("");await expect(rows).toHaveCount(1);await expect(expand()).toHaveAttribute("aria-expanded","false");
});
