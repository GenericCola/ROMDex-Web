import {test,expect} from "@playwright/test";
import {structuralFixture} from "./structural-fixture";
test.use({serviceWorkers:"block"});
const select=async(page:import("@playwright/test").Page,name:string)=>{await page.getByRole("button",{name,exact:true}).last().click();};
test("notes persist locally while focused; explicit Save and leaving the editor send only complete snapshots",async({page})=>{
 await page.clock.install();const s=await structuralFixture(page);await s.connect();await page.getByRole("switch",{name:"Auto-Sync Data",exact:true}).click();await select(page,"Fixture Root");
 const notes=page.getByRole("textbox",{name:"Notes and Instructions",exact:true});
 await notes.fill("Partial note");await expect(page.getByText("All changes saved in this browser",{exact:true})).toBeVisible();await page.clock.fastForward(31000);expect(s.writes).toHaveLength(0);
 await notes.fill("Replacement");await notes.fill("");await notes.fill("Completed note");await page.clock.fastForward(31000);expect(s.writes).toHaveLength(0);
 await expect(notes).toHaveValue("Completed note");await expect(page.getByText("Edits save locally. When connected, Auto-Sync waits until you leave this editor. Save Changes can send the current version.",{exact:true})).toBeVisible();
 await s.save();await s.confirmed();expect(s.tasks.get("PMON-900001")?.description).toBe("Completed note");const count=s.writes.length;
 await notes.fill("Next completed revision");await page.clock.fastForward(31000);expect(s.writes).toHaveLength(count);
 await select(page,"Fixture Other");await page.clock.fastForward(11000);await s.confirmed();await expect.poll(()=>s.tasks.get("PMON-900001")?.description).toBe("Next completed revision");
 await select(page,"Fixture Root");await expect(notes).toHaveValue("Next completed revision");await expect(page.getByText("All changes saved in this browser",{exact:true})).toBeVisible();await page.reload();await expect(page.getByRole("textbox",{name:"Task Title",exact:true})).toHaveValue("Fixture Root");await expect(notes).toHaveValue("Next completed revision");
 await s.connect();await page.getByRole("switch",{name:"Auto-Sync Data",exact:true}).click();const offCount=s.writes.length;
 await notes.fill("Manual-only note");await select(page,"Fixture Other");await page.clock.fastForward(31000);expect(s.writes).toHaveLength(offCount);await s.save();await s.confirmed();expect(s.tasks.get("PMON-900001")?.description).toBe("Manual-only note");await expect(page.getByRole("switch",{name:"Auto-Sync Data",exact:true})).toHaveAttribute("aria-checked","false");
});
test("a longer independent YouTrack note still shows the real conflict and preserves both versions",async({page})=>{
 const s=await structuralFixture(page);await s.connect();await select(page,"Fixture Root");const notes=page.getByRole("textbox",{name:"Notes and Instructions",exact:true});await notes.fill("Local complete note");
 s.tasks.get("PMON-900001")!.description="Local complete note with an independent external edit";s.tasks.get("PMON-900001")!.updated++;
 await s.save();await expect(page.getByText("Review conflicting edits. Both versions were preserved.",{exact:true})).toBeVisible();expect(s.writes).toHaveLength(0);await expect(notes).toHaveValue("Local complete note");
 await page.getByRole("button",{name:"Connection Details",exact:true}).click();await expect(page.getByRole("heading",{name:"Conflicting edits",exact:true})).toBeVisible();await expect(page.getByText(/Local complete note with an independent external edit/).first()).toBeVisible();
});
test("typed notes remain exportable after interrupted local storage and no cloud request is sent",async({page})=>{
 const s=await structuralFixture(page);await s.connect();await select(page,"Fixture Root");
 // Let the selection save finish so the injected failure belongs to the note edit.
 await expect(page.getByText("All changes saved in this browser",{exact:true})).toBeVisible();
 await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){const result=key===undefined?put.call(this,value):put.call(this,value,key);if(this.name==="workspace")this.transaction.abort();return result;};});
 const notes=page.getByRole("textbox",{name:"Notes and Instructions",exact:true});await notes.fill("Keep this complete note after disk failure");
 await expect(page.getByText("Local save needs attention",{exact:true})).toBeVisible();await expect(notes).toHaveValue("Keep this complete note after disk failure");expect(s.writes).toHaveLength(0);
 const downloading=page.waitForEvent("download");await page.getByRole("button",{name:"Export Recovery Copy",exact:true}).click();const download=await downloading,path=await download.path();expect(path).not.toBeNull();
 const {readFile}=await import("node:fs/promises");const recovery=JSON.parse(await readFile(path!,"utf8"));expect(recovery.data.operations.some((op:{type:string;patch?:{description?:string}})=>op.type==="edit"&&op.patch?.description==="Keep this complete note after disk failure")).toBe(true);expect(s.writes).toHaveLength(0);
});