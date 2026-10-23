import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve,extname} from 'node:path';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.playwright-browsers');
const {chromium,expect}=await import('@playwright/test');
const root=resolve(process.argv[2]||'artifacts/desktop-task-filters/patched');
const {reconcile}=await import(pathToFileURL(resolve(root,'core.mjs')));
const browser=await chromium.launch();
const initial={id:'PMON-900001',summary:'Synthetic Notes Task',description:'Before',state:'To do',assignedState:'To do',parentId:null,priority:'Normal',complexity:null,type:'Task',updated:1,comments:[],commentCount:0,dependencies:0,fields:{},attachments:[]};
const fixture=async()=>{
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),remote=structuredClone(initial),mutations=[],errors=[];
 let hold=false,release,started;const startedRequest=new Promise(resolve=>{started=resolve;});const gate=new Promise(resolve=>{release=resolve;});
 const status={version:'synthetic',connected:true,automaticSyncEnabled:true,youtrackAvailable:true,syncControl:true,connection:{missingStates:[],localAssignedStatus:true,complexity:{ready:true}}};
 const second={...structuredClone(remote),id:'PMON-900002',summary:'Synthetic Done Child',parentId:remote.id,state:'Done',assignedState:'Done',priority:'Major',complexity:'HIGH',assignee:'1-1',assigneeName:'Synthetic Person'};remote.state='Done';remote.assignedState='Needs Testing';
 const state={version:1,remote:[structuredClone(remote),second],operations:[],order:{},images:{},expanded:[],selectorExpanded:[],blocked:null};
 const json=(route,body)=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;
  if(url.origin!=='http://127.0.0.1:3100'){errors.push('External request refused');await route.abort();return;}
  if(path==='/addons/npcdex/index.html'){await route.fulfill({contentType:'text/html',body:`<!doctype html><script>window.romdexWorkspace={kind:'npcdex',ready:Promise.resolve(),status:()=>({label:'NPCDex',cloud:false,connection:'local',automaticRemote:false,localCheckpoint:true,attention:false,message:'Synthetic local provider'}),manualSave:async()=>({ok:true}),checkpoint:async()=>{},resize:()=>{}};</script>`});return;}
  if(path==='/api/status'){await json(route,status);return;}
  if(path==='/api/backup'){await json(route,req.method()==='GET'?state:{ok:true});return;}
  if(path==='/api/comments'){await json(route,{...status,comments:[]});return;}
  if(path==='/api/snapshot'){await json(route,{...status,items:[structuredClone(remote),second],at:1});return;}
  if(path==='/api/sync'){
   const body=req.postDataJSON();if(hold){hold=false;started();await gate;}
   const completed=[];let blocked=null;
   for(const op of body.operations){const result=reconcile(op.base,op.patch,remote);if(result.conflicts.length){blocked={opId:op.opId,conflicts:result.conflicts,remote:structuredClone(remote)};break;}mutations.push(structuredClone(op));Object.assign(remote,result.patch);remote.updated++;completed.push(op.opId);}
   await json(route,{...status,completed,mapping:{},blocked,items:[structuredClone(remote),second],at:1});return;
  }
  const relative=path.replace(/^\//,'');
  if(!/^(?:[\w-]+\.(?:mjs|css|html|svg)|shared-ui\/[\w-]+\.(?:mjs|css|svg))$/.test(relative)){errors.push(path);await route.abort();return;}
  try{const body=await readFile(resolve(root,relative));await route.fulfill({contentType:({'.mjs':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'})[extname(relative)],body});}catch{errors.push(path);await route.abort();}
 });
 page.on('pageerror',error=>errors.push(error.message));await page.clock.install();await page.goto('http://127.0.0.1:3100/index.html');
 await page.waitForFunction(()=>window.romdexShell?.host.views.size===2&&!window.romdexShell.native.busy);const view=page.frame({url:/tasks.html/});
 await view.getByRole('button',{name:'Synthetic Notes Task',exact:true}).click();await expect(view.locator('#notes')).toBeVisible();
 const ready=async()=>expect.poll(()=>page.evaluate(()=>{const w=window.romdexShell.native;return w.pendingWrites===0&&!w.busy;})).toBe(true);
 return {context,page,view,remote,mutations,errors,ready,holdNext:()=>{hold=true;return {started:startedRequest,release};}};
};
try{
 await test('desktop filter popup renders, matches inherited status and metadata, clears and preserves tasks',async()=>{
 const s=await fixture();try{
 const rows=s.view.locator('#rows .task-row'),button=s.view.getByRole('button',{name:'Filters',exact:true});
 await button.click();const dialog=s.view.getByRole('dialog',{name:'Filters',exact:true});await expect(dialog).toBeVisible();
 await dialog.getByLabel('Filter Status',{exact:true}).selectOption('green');await expect(rows).toHaveCount(2);
 await expect(button).toHaveAttribute('aria-pressed','true');assert.equal(await button.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(129, 199, 154)');
 await dialog.getByLabel('Filter Assignee',{exact:true}).selectOption('1-1');await dialog.getByLabel('Filter Priority',{exact:true}).selectOption('Major');await dialog.getByLabel('Filter Complexity',{exact:true}).selectOption('HIGH');await expect(rows).toHaveCount(1);await expect(rows.first()).toContainText('Synthetic Done Child');
 await s.page.screenshot({path:resolve('artifacts/desktop-task-filters/popup.png')});
 const clear=dialog.getByRole('button',{name:'Clear All',exact:true}),close=dialog.getByRole('button',{name:'Close',exact:true});const a=await clear.boundingBox(),b=await close.boundingBox();assert.ok(a.x>b.x);
 await clear.click();await expect(button).toHaveAttribute('aria-pressed','false');await dialog.getByLabel('Filter Status',{exact:true}).selectOption('amber');await expect(rows).toHaveCount(0);await expect(s.view.locator('#empty h3')).toHaveText('No Matching Items');
 await s.page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(button).toBeFocused();await button.click();await dialog.getByRole('button',{name:'Clear All',exact:true}).click();await close.click();await expect(rows).toHaveCount(1);assert.deepEqual(s.mutations,[]);assert.deepEqual(s.errors,[]);
 }finally{await s.context.close();}
 });
 await test('desktop filter refuses an unfinished inline task without hiding its draft',async()=>{
 const s=await fixture();try{await s.view.locator('#add-work').click();await s.view.locator('#draft-title').fill('Unfinished synthetic title');await s.view.getByRole('button',{name:'Filters',exact:true}).click();await expect(s.view.locator('#toast')).toHaveText('Finish the current task editor before filtering.');await expect(s.view.locator('#task-filter-dialog')).not.toBeVisible();await expect(s.view.locator('#draft-title')).toHaveValue('Unfinished synthetic title');assert.deepEqual(s.mutations,[]);assert.deepEqual(s.errors,[]);}finally{await s.context.close();}
 });
}finally{await browser.close();}
