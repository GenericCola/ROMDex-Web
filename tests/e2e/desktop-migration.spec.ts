import {emptyWorkspace} from "../../src/domain/workspace-data";
import {test,expect,type Page} from "@playwright/test";
import {readFile} from "node:fs/promises";
import {desktopFixture} from "./desktop-fixture";
import {openRecoveryWorkspace} from "./local-workspace";

test.use({serviceWorkers:"block"});
// Recovery mode adds a tall strip above the work tray; give it room so rows stay clickable.
test.beforeEach(async({page})=>{const size=page.viewportSize();if(size)await page.setViewportSize({width:size.width,height:Math.max(size.height,1400)});});
const importDesktop=async(page:Page)=>{
 await openRecoveryWorkspace(page);await page.getByRole("button",{name:"Import Desktop or Recovery Data",exact:true}).click();
 await page.getByLabel("Export or recovery JSON",{exact:true}).setInputFiles({name:"synthetic-desktop.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(desktopFixture()))});
 await expect(page.getByText("File verified locally. No cloud request was made.",{exact:true})).toBeVisible();
 await page.getByRole("checkbox",{name:/I have preserved my current recovery copy/}).check();await page.getByRole("button",{name:"Import Reviewed Data",exact:true}).click();
 await expect(page.getByRole("dialog",{name:"Import Desktop or Recovery Data",exact:true})).toHaveCount(0);
};
const openPoint=async(page:Page)=>{
 await page.getByRole("combobox",{name:"Map",exact:true}).selectOption("map");await page.getByRole("combobox",{name:"Area",exact:true}).selectOption("area");await page.getByRole("combobox",{name:"Encounter",exact:true}).selectOption("actor");await page.getByRole("combobox",{name:"Dialogue point",exact:true}).selectOption("point");
};

test("desktop migration retains pending work in recovery and NPCDex drafts survive save, reload and export",async({page})=>{
 const sent:string[]=[];page.on("request",request=>{if(new URL(request.url()).pathname==="/api/youtrack"&&request.method()!=="GET")sent.push(request.method());});
 await importDesktop(page);await page.getByRole("button",{name:"Migration fixture root",exact:true}).last().click();await expect(page.locator("#details").getByRole("button",{name:"Set Status for Migration fixture root",exact:true})).toContainText("Standby");
 await page.getByRole("button",{name:"Switch Workspace",exact:true}).click();await page.getByRole("menuitemradio",{name:"NPCDex",exact:true}).click();await openPoint(page);
 await expect(page.getByText("Current boy dialogue",{exact:true})).toBeVisible();await page.getByRole("combobox",{name:"Player gender",exact:true}).selectOption("female");await expect(page.getByText("Current girl dialogue",{exact:true})).toBeVisible();await expect(page.getByText("Current boy dialogue",{exact:true})).toHaveCount(0);
 await page.getByRole("textbox",{name:"Proposed dialogue",exact:true}).fill("A separate proposed dialogue draft");await expect(page.getByText("Unsaved NPCDex draft",{exact:true}).first()).toBeVisible();await page.getByRole("button",{name:"Save NPCDex Draft",exact:true}).click();await expect(page.getByText("Draft saved in this browser. Current content and testing evidence are unchanged.",{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole("combobox",{name:"Player gender",exact:true})).toHaveValue("female");await openPoint(page);await expect(page.getByRole("textbox",{name:"Proposed dialogue",exact:true})).toHaveValue("A separate proposed dialogue draft");await expect(page.getByText("Current girl dialogue",{exact:true})).toBeVisible();
 const downloadPromise=page.waitForEvent("download");await page.getByRole("button",{name:"Export Recovery Copy",exact:true}).click();const download=await downloadPromise,path=await download.path();expect(path).not.toBeNull();const recovery=JSON.parse(await readFile(path!,"utf8"));expect(recovery.data.operations).toHaveLength(0);expect(recovery.data.migration.pending).toHaveLength(1);expect(recovery.data.npcdex.unknownExtension).toEqual({keep:true});expect(recovery.data.npcdex.annotations["point:point"].testStatus).toBe("tested");expect(sent).toEqual([]);
});

test("a corrupted desktop export cannot replace browser data",async({page})=>{
 const fixture=desktopFixture();fixture.files[0]!.sha256="0".repeat(64);await openRecoveryWorkspace(page);await page.getByRole("button",{name:"Import Desktop or Recovery Data",exact:true}).click();await page.getByLabel("Export or recovery JSON",{exact:true}).setInputFiles({name:"corrupt.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(fixture))});await expect(page.getByText(/integrity check failed/)).toBeVisible();await expect(page.getByRole("button",{name:"Import Reviewed Data",exact:true})).toHaveCount(0);
});



test("recovery export stays available after failed browser saving and retains editor text",async({page})=>{
 await importDesktop(page);await page.getByRole("button",{name:"Switch Workspace",exact:true}).click();await page.getByRole("menuitemradio",{name:"NPCDex",exact:true}).click();await openPoint(page);
 // Finish navigation writes before injecting the draft-save failure.
 await expect(page.getByText("All changes saved in this browser",{exact:true})).toBeVisible();
 await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){const result=key===undefined?put.call(this,value):put.call(this,value,key);if(this.name==="workspace")this.transaction.abort();return result;};});
 await page.getByRole("textbox",{name:"Proposed dialogue",exact:true}).fill("Recover this editor after storage failure");await page.getByRole("combobox",{name:"Feedback flag",exact:true}).selectOption("critical");await expect(page.getByRole("textbox",{name:"Proposed dialogue",exact:true})).toHaveValue("Recover this editor after storage failure");await page.getByRole("button",{name:"Save NPCDex Draft",exact:true}).click();await expect(page.getByRole("alert").filter({hasText:/Browser storage could not save/})).toBeVisible();await expect(page.getByText("Local save needs attention",{exact:true})).toBeVisible();
 const pending=page.waitForEvent("download");await page.getByRole("alert",{name:"Local save recovery",exact:true}).getByRole("button",{name:"Export Recovery Copy",exact:true}).click();const download=await pending,path=await download.path();expect(path).not.toBeNull();const recovery=JSON.parse(await readFile(path!,"utf8"));expect(recovery.data.editorRecovery[0].draft.proposedText).toBe("Recover this editor after storage failure");expect(recovery.data.editorRecovery[0].draft.flag).toBe("critical");
 await page.reload();await page.getByRole("button",{name:"Import Desktop or Recovery Data",exact:true}).click();await page.getByLabel("Export or recovery JSON",{exact:true}).setInputFiles({name:"recovery.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(recovery))});await expect(page.getByText("File verified locally. No cloud request was made.",{exact:true})).toBeVisible();await page.getByRole("checkbox",{name:/I have preserved my current recovery copy/}).check();await page.getByRole("button",{name:"Import Reviewed Data",exact:true}).click();
 if(!await page.getByRole("button",{name:"Restore Recovered Draft 1",exact:true}).isVisible())await page.getByText(/Recovered unsaved editors/).click();await page.getByRole("button",{name:"Restore Recovered Draft 1",exact:true}).click();await expect(page.getByText("Recovered draft saved. Current content is unchanged.",{exact:true})).toBeVisible();await expect(page.getByRole("textbox",{name:"Proposed dialogue",exact:true})).toHaveValue("Recover this editor after storage failure");
 recovery.data.npcdex.revision++;await page.getByRole("button",{name:"Import Desktop or Recovery Data",exact:true}).click();await page.getByLabel("Export or recovery JSON",{exact:true}).setInputFiles({name:"stale-recovery.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(recovery))});await expect(page.getByText("File verified locally. No cloud request was made.",{exact:true})).toBeVisible();await page.getByRole("checkbox",{name:/I have preserved my current recovery copy/}).check();await page.getByRole("button",{name:"Import Reviewed Data",exact:true}).click();if(!await page.getByRole("button",{name:"Restore Recovered Draft 1",exact:true}).isVisible())await page.getByText(/Recovered unsaved editors/).click();await page.getByRole("button",{name:"Restore Recovered Draft 1",exact:true}).click();await expect(page.getByText("NPCDex content changed. Preserve and review the draft against its new revision.",{exact:true})).toBeVisible();

});


test("dirty, saving and saved messages select their actual editor and I/O states",async({page})=>{
 await importDesktop(page);await page.getByRole("button",{name:"Switch Workspace",exact:true}).click();await page.getByRole("menuitemradio",{name:"NPCDex",exact:true}).click();await openPoint(page);
 await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){if(this.name==="workspace"){const store=this;let hold=true;setTimeout(()=>{hold=false;},1000);const keepAlive=()=>{const request=store.get("acceptance-hold");request.onsuccess=()=>{if(hold)keepAlive();};};keepAlive();}return key===undefined?put.call(this,value):put.call(this,value,key);};});
 await page.getByRole("textbox",{name:"Proposed dialogue",exact:true}).fill("Message path fixture");await expect(page.getByText("Unsaved NPCDex draft",{exact:true}).first()).toBeVisible();await page.getByRole("button",{name:"Save NPCDex Draft",exact:true}).click();await expect(page.getByText("Saving in this browser…",{exact:true})).toBeVisible();await expect(page.getByText("All changes saved in this browser",{exact:true})).toBeVisible();
});


test("invalid recovery layout and spoofed YouTrack links show refusal and offer no import",async({page})=>{
 await openRecoveryWorkspace(page);await page.getByRole("button",{name:"Import Desktop or Recovery Data",exact:true}).click();const data=emptyWorkspace();data.view.workHeight=Number.NaN;await page.getByLabel("Export or recovery JSON",{exact:true}).setInputFiles({name:"bad-layout.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify({format:"ROMDexWebRecovery/1",data}))});await expect(page.getByText("The workspace layout or draft data is invalid. Existing browser data has been kept.",{exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Import Reviewed Data",exact:true})).toHaveCount(0);
 data.view.workHeight=46;data.remote=[{id:"PMON-900001",summary:"Synthetic link fixture",description:"",parentId:null,state:"To do",priority:"Normal",complexity:null,type:"Epic",updated:1,comments:[],commentCount:0,url:"javascript:alert(1)"}];await page.getByLabel("Export or recovery JSON",{exact:true}).setInputFiles({name:"bad-link.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify({format:"ROMDexWebRecovery/1",data}))});await expect(page.getByText("Task links must point to their verified YouTrack issue.",{exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Import Reviewed Data",exact:true})).toHaveCount(0);
});
