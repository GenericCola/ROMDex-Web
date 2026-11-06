import {test,expect} from "@playwright/test";
import {structuralFixture} from "./structural-fixture";
import {storedSelection} from "./task-status";
test.use({serviceWorkers:"block"});
const save=(page:import("@playwright/test").Page)=>page.getByRole("button",{name:/^Save Changes/});
// The "All changes saved in this browser" line only shows in recovery mode; the Save title carries the same no-draft, no-pending-write state.
const saved=(page:import("@playwright/test").Page,queued=0)=>expect(save(page)).toHaveAttribute("title",queued?queued+" queued change"+(queued>1?"s":"")+" not yet confirmed in YouTrack.":"No pending changes in this browser.");
const select=async(page:import("@playwright/test").Page,name:string)=>{await page.getByRole("button",{name,exact:true}).last().click();};
test("notes persist locally while focused; explicit Save and leaving the editor send only complete snapshots",async({page})=>{
 await page.clock.install();const s=await structuralFixture(page);await s.connect();await page.getByRole("switch",{name:"Auto-Sync Data",exact:true}).click();await select(page,"Fixture Root");
 const notes=page.getByRole("textbox",{name:"Notes and Instructions",exact:true});
 await notes.fill("Partial note");await saved(page,1);await page.clock.fastForward(31000);expect(s.writes).toHaveLength(0);
 await notes.fill("Replacement");await notes.fill("");await notes.fill("Completed note");await page.clock.fastForward(31000);expect(s.writes).toHaveLength(0);
 await expect(notes).toHaveValue("Completed note");await expect(page.getByText("Edits save locally. When connected, Auto-Sync waits five minutes after typing while this editor stays focused. Leaving the editor or Save Changes can send the current version.",{exact:true})).toBeVisible();
 await s.save();await s.confirmed();expect(s.tasks.get("PMON-900001")?.description).toBe("Completed note");const count=s.writes.length;
 await notes.fill("Next completed revision");await page.clock.fastForward(31000);expect(s.writes).toHaveLength(count);
 await select(page,"Fixture Other");await page.clock.fastForward(11000);await s.confirmed();await expect.poll(()=>s.tasks.get("PMON-900001")?.description).toBe("Next completed revision");
 await select(page,"Fixture Root");await expect(notes).toHaveValue("Next completed revision");await saved(page);await page.reload();await expect(page.getByRole("textbox",{name:"Task Title",exact:true})).toHaveValue("Fixture Root");await expect(notes).toHaveValue("Next completed revision");
 await s.connect();await page.getByRole("switch",{name:"Auto-Sync Data",exact:true}).click();const offCount=s.writes.length;
 await notes.fill("Manual-only note");await select(page,"Fixture Other");await page.clock.fastForward(31000);expect(s.writes).toHaveLength(offCount);await s.save();await s.confirmed();expect(s.tasks.get("PMON-900001")?.description).toBe("Manual-only note");await expect(page.getByRole("switch",{name:"Auto-Sync Data",exact:true})).toHaveAttribute("aria-checked","false");
});
test("a longer independent YouTrack note still shows the real conflict and preserves both versions",async({page})=>{
 const s=await structuralFixture(page);await s.connect();await select(page,"Fixture Root");const notes=page.getByRole("textbox",{name:"Notes and Instructions",exact:true});await notes.fill("Local complete note");
 s.tasks.get("PMON-900001")!.description="Local complete note with an independent external edit";s.tasks.get("PMON-900001")!.updated++;
 await s.save();await s.uncertain();expect(s.writes).toHaveLength(0);await expect(notes).toHaveValue("Local complete note");
 await page.getByRole("button",{name:/^Connection Details/}).click();const card=page.locator(".delivery-review-card");await expect(card.getByRole("heading",{name:"Review PMON-900001 · Fixture Root",exact:true})).toBeVisible();await expect(card.getByText("This task also changed in YouTrack. Choose which version to keep.",{exact:true})).toBeVisible();
 // Note text is withheld from the review card, but both versions are listed and each can be kept.
 await expect(card.getByText("YOUR CHANGE: content withheld",{exact:true})).toBeVisible();await expect(card.getByText("CURRENT YOUTRACK: content withheld",{exact:true})).toBeVisible();await expect(card.getByRole("button",{name:/^Use my (choice|changes)/})).toBeVisible();await expect(card.getByRole("button",{name:/^Keep YouTrack/})).toBeVisible();await card.getByText("Raw diagnostics (optional)",{exact:true}).click();await expect(card.getByText("Both browser and YouTrack changed these fields.",{exact:true})).toBeVisible();await expect(card.locator("pre")).toContainText("Local complete note with an independent external edit");
});
test("typed notes remain exportable after interrupted local storage and no cloud request is sent",async({page})=>{
 const s=await structuralFixture(page);await s.connect();await select(page,"Fixture Root");
 // Let the selection save finish so the injected failure belongs to the note edit.
 await saved(page);await expect.poll(()=>storedSelection(page)).toBe("PMON-900001");
 await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){const result=key===undefined?put.call(this,value):put.call(this,value,key);if(this.name==="workspace")this.transaction.abort();return result;};});
 const notes=page.getByRole("textbox",{name:"Notes and Instructions",exact:true});await notes.fill("Keep this complete note after disk failure");
 await expect(page.getByRole("alert",{name:"Local save recovery",exact:true})).toBeVisible();await expect(save(page)).toHaveAttribute("title",/^Local save needs attention/);await expect(notes).toHaveValue("Keep this complete note after disk failure");expect(s.writes).toHaveLength(0);
 const downloading=page.waitForEvent("download");await page.getByRole("button",{name:"Export Recovery Copy",exact:true}).click();const download=await downloading,path=await download.path();expect(path).not.toBeNull();
 const {readFile}=await import("node:fs/promises");const recovery=JSON.parse(await readFile(path!,"utf8"));expect(recovery.data.operations.some((op:{type:string;patch?:{description?:string}})=>op.type==="edit"&&op.patch?.description==="Keep this complete note after disk failure")).toBe(true);expect(s.writes).toHaveLength(0);
});