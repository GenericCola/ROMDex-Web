import {writeRdx,readRdx,documentRevision} from "../../src/rdx/container";
import {jsonObject} from "../../src/domain/json";
import {planDocument} from "../fixtures/rdx";
import {test,expect,type Page} from "@playwright/test";
import {structuralFixture} from "./structural-fixture";
import {readFile} from "node:fs/promises";
const tool=async(page:Page,name:"IMPORT RDX"|"EXPORT RDX")=>{await page.getByRole("button",{name:"TOOLS",exact:true}).click();await page.getByRole("button",{name,exact:true}).click();};
const open=async(page:Page,name:"IMPORT RDX"|"EXPORT RDX")=>{const s=await structuralFixture(page);await tool(page,name);return s;};
const fixture=(name:string)=>{return readFile(new URL("../fixtures/"+name,import.meta.url));};
test.use({serviceWorkers:"block"});
test("RDX worker validates a native map and retains the exact file across reload and export",async({page})=>{
 const bytes=await fixture("native-map.rdx");const s=await open(page,"IMPORT RDX");
 await page.getByLabel("RDX file",{exact:true}).setInputFiles({name:"synthetic-map.rdx",mimeType:"application/octet-stream",buffer:bytes});
 await expect(page.getByText("RDX verified locally. No YouTrack changes were queued.",{exact:true})).toBeVisible();
 await page.getByRole("checkbox",{name:/I reviewed this file/}).check();await page.getByRole("button",{name:"Open Map in NPCDex",exact:true}).click();
 await expect(page.getByText(/Map opened. The preceding NPCDex/)).toBeVisible();await page.getByRole("button",{name:"Close IMPORT RDX",exact:true}).click();
 await expect(page.getByRole("main",{name:"NPCDex Workspace",exact:true})).toBeVisible();await page.reload();await page.getByRole("button",{name:"Switch Workspace",exact:true}).click();await page.getByRole("menuitemradio",{name:"ROMDex",exact:true}).click();await tool(page,"EXPORT RDX");
 const pending=page.waitForEvent("download");await page.getByRole("button",{name:"Export synthetic-map.rdx",exact:true}).click();const download=await pending,path=await download.path();expect(path).not.toBeNull();expect(await readFile(path!)).toEqual(bytes);expect(s.writes).toHaveLength(0);
});
test("malformed RDX bytes leave the local library unchanged",async({page})=>{
 await open(page,"IMPORT RDX");await page.getByLabel("RDX file",{exact:true}).setInputFiles({name:"invalid.rdx",mimeType:"application/octet-stream",buffer:Buffer.from("not an RDX file")});
 await expect(page.getByRole("status").filter({hasText:/RDX|Magic|magic|header|Header|Truncated/}).last()).toBeVisible();await expect(page.getByRole("button",{name:"Save RDX in Browser",exact:true})).toHaveCount(0);
});


test("RDX plan conflicts show both versions and save only the reviewed choice without task delivery",async({page})=>{
 const s=await open(page,"IMPORT RDX");const first=planDocument(),second=structuredClone(first),task=jsonObject((jsonObject(second.content).tasks as never[])[0]);task.title="Reviewed incoming title";second.revision=documentRevision(second);const bytes=await writeRdx(first,new Map()),incoming=await writeRdx(second,new Map());
 await page.getByLabel("RDX file",{exact:true}).setInputFiles({name:"plan.rdx",mimeType:"application/octet-stream",buffer:Buffer.from(bytes)});await expect(page.getByText("RDX verified locally. No YouTrack changes were queued.",{exact:true})).toBeVisible();await page.getByRole("checkbox",{name:/I reviewed this file/}).check();await page.getByRole("button",{name:"Save RDX in Browser",exact:true}).click();await expect(page.getByText("RDX saved in this browser. Export a recovery copy for backup.",{exact:true})).toBeVisible();
 await page.getByLabel("RDX file",{exact:true}).setInputFiles({name:"plan-update.rdx",mimeType:"application/octet-stream",buffer:Buffer.from(incoming)});await expect(page.getByText("Choose every conflict before saving.",{exact:true})).toBeVisible();await expect(page.getByRole("checkbox",{name:/I reviewed this file/})).toBeDisabled();await page.getByText("Browser version",{exact:true}).click();await expect(page.locator("pre").filter({hasText:'"title": "Synthetic task"'})).toBeVisible();await page.getByText("Incoming version",{exact:true}).click();await expect(page.locator("pre").filter({hasText:'"title": "Reviewed incoming title"'})).toBeVisible();
 await page.getByRole("combobox",{name:"Version for task:fixture",exact:true}).selectOption("incoming");await expect(page.getByRole("checkbox",{name:/I reviewed this file/})).toBeEnabled();await page.getByRole("checkbox",{name:/I reviewed this file/}).check();await page.getByRole("button",{name:"Save RDX in Browser",exact:true}).click();await expect(page.getByText("RDX saved in this browser. Export a recovery copy for backup.",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Close IMPORT RDX",exact:true}).click();await tool(page,"EXPORT RDX");const pending=page.waitForEvent("download");await page.getByRole("button",{name:"Export plan-update.rdx",exact:true}).last().click();const download=await pending,path=await download.path();expect(path).not.toBeNull();const checked=await readRdx(await readFile(path!));expect(jsonObject((jsonObject(checked.document.content).tasks as never[])[0]).title).toBe("Reviewed incoming title");expect(s.writes).toHaveLength(0);
});
