import {test,expect,type Locator} from "@playwright/test";
import {structuralFixture} from "./structural-fixture";

test.use({serviceWorkers:"block"});
const box=async(locator:Locator)=>{const value=await locator.boundingBox();expect(value).not.toBeNull();return value!;};
const screen=async(page:import("@playwright/test").Page,name:string)=>page.screenshot({path:`artifacts/ui-repair/${test.info().project.name}-${name}.png`,fullPage:true});

test("task properties and notes use separate usable columns and narrow windows scroll without overlap",async({page})=>{
 await page.setViewportSize({width:1280,height:800});
 await structuralFixture(page);
 await page.getByRole("button",{name:"Fixture Root",exact:true}).last().click();
 const save=page.getByRole("button",{name:/^Save Changes/});
 await expect(save.locator('.save-light.green')).toBeVisible();
 const spacing=await save.evaluate(el=>{const text=[...el.childNodes].find(node=>node.nodeType===Node.TEXT_NODE&&node.textContent?.includes('Save Changes'));if(!text)return -1;const range=document.createRange();range.selectNodeContents(text);return el.querySelector('.save-light')!.getBoundingClientRect().left-range.getBoundingClientRect().right;});
 expect(spacing).toBeGreaterThanOrEqual(8);
 const notes=page.getByRole("textbox",{name:"Notes and Instructions",exact:true});
 await notes.fill("Synthetic layout review only. A longer note checks that properties, the editor and attachment controls remain reachable without overlapping other panes.");
 await expect(save.locator('.save-light.red')).toBeVisible();
 for(const width of [1280,800,390,320]){
  await page.setViewportSize({width,height:800});
  await page.locator('.detail-summary').evaluate(el=>{el.scrollTop=0;});
  await page.locator('.port-detail-content').evaluate(el=>{el.scrollTop=0;});
  const properties=await box(page.getByRole("region",{name:"Task Properties",exact:true}));
  expect(properties.height).toBeGreaterThan(180);
  if(width>700){
   const writing=await box(notes);expect(writing.x).toBeGreaterThan(properties.x+properties.width);expect(writing.width).toBeGreaterThan(width===1280?550:280);
   const title=await box(page.getByRole('textbox',{name:'Task Title',exact:true}));expect(title.y).toBeGreaterThanOrEqual(properties.y);expect(title.y+title.height).toBeLessThanOrEqual(properties.y+properties.height);
  }
  await notes.scrollIntoViewIfNeeded();await notes.fill(`Synthetic note at ${width}px. Kept in the browser only.`);
  await expect(notes).toHaveValue(`Synthetic note at ${width}px. Kept in the browser only.`);
  await screen(page,`details-${width}`);
  await page.getByRole("button",{name:"Review Archived Staged Copies",exact:true}).scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  for(const name of ['Switch Workspace','Connection Details']){const button=await box(page.getByRole('button',{name,exact:true}));expect(button.width).toBeGreaterThanOrEqual(34);expect(button.height).toBeGreaterThanOrEqual(34);expect(button.x).toBeGreaterThanOrEqual(0);expect(button.x+button.width).toBeLessThanOrEqual(width);}
 }
});

test("workspace menu dismisses with Escape, Tab and outside click",async({page})=>{
 await page.goto('/');
 const trigger=page.getByRole('button',{name:'Switch Workspace',exact:true}),menu=page.getByRole('menu',{name:'Workspaces',exact:true});
 for(const width of [1280,800,390,320]){
  await page.setViewportSize({width,height:800});await trigger.focus();await page.keyboard.press('ArrowDown');await expect(menu).toBeVisible();await expect(menu.getByRole('menuitemradio',{name:'ROMDex',exact:true})).toBeFocused();
  const rect=await box(menu);expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.x+rect.width).toBeLessThanOrEqual(width);
  await page.keyboard.press('ArrowDown');await expect(menu.getByRole('menuitemradio',{name:'NPCDex',exact:true})).toBeFocused();await page.keyboard.press('Home');await expect(menu.getByRole('menuitemradio',{name:'ROMDex',exact:true})).toBeFocused();await page.keyboard.press('End');await expect(menu.getByRole('menuitemradio',{name:'NPCDex',exact:true})).toBeFocused();await screen(page,`menu-${width}`);
  await page.keyboard.press('Escape');await expect(menu).not.toBeVisible();await expect(trigger).toBeFocused();
 }
 await trigger.click();await page.getByRole('heading',{name:'ROMDex',exact:true}).click();await expect(menu).not.toBeVisible();
 await trigger.click();await page.keyboard.press('End');await page.keyboard.press('Tab');await expect(menu).not.toBeVisible();
 await trigger.click();await menu.getByRole('menuitemradio',{name:'NPCDex',exact:true}).click();await expect(page.getByRole('heading',{name:'NPCDex',exact:true,level:1})).toBeVisible();await expect(trigger).toBeFocused();
 await trigger.click();await menu.getByRole('menuitemradio',{name:'ROMDex',exact:true}).click();await expect(page.getByRole('heading',{name:'ROMDex',exact:true})).toBeVisible();
});

test("connection dialog is centered and keeps its close control reachable through read errors and scrolling",async({page})=>{
 await page.route('https://thegobindsingh.youtrack.cloud/api/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"Synthetic unavailable service"}'}));
 await page.goto('/');
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:800});await page.getByRole('button',{name:'Connection Details',exact:true}).focus();await page.keyboard.press('Enter');
  const dialog=page.getByRole('dialog',{name:'Connection Details',exact:true});const rect=await box(dialog);expect(Math.abs(rect.x-(width-rect.width)/2)).toBeLessThan(2);expect(rect.y).toBeGreaterThanOrEqual(0);expect(rect.y+rect.height).toBeLessThanOrEqual(800);
  await dialog.getByLabel('YouTrack Permanent Token',{exact:true}).fill('synthetic-ui-token');await dialog.getByRole('button',{name:'Read YouTrack Tasks',exact:true}).click();
  const error=dialog.getByRole('status').filter({hasText:'503'});await expect(error).toBeVisible();await error.scrollIntoViewIfNeeded();await expect(error).toBeInViewport();await screen(page,`connection-error-${width}`);
  const close=dialog.getByRole('button',{name:'Close Connection Details',exact:true});const closeRect=await box(close);expect(closeRect.y).toBeGreaterThanOrEqual(rect.y);expect(closeRect.y+closeRect.height).toBeLessThanOrEqual(rect.y+70);
  await close.click();await expect(dialog).not.toBeVisible();await expect(page.getByRole('button',{name:'Connection Details',exact:true})).toBeFocused();
 }
});
