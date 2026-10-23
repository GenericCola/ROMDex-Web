import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve,extname} from 'node:path';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.playwright-browsers');
const {chromium,expect}=await import('@playwright/test');
const root=resolve(process.argv[2]||'artifacts/desktop-notes-fix/patched');
const {reconcile}=await import(pathToFileURL(resolve(root,'core.mjs')));
const browser=await chromium.launch();
const initial={id:'PMON-900001',summary:'Synthetic Notes Task',description:'Before',state:'To do',assignedState:'To do',parentId:null,priority:'Normal',complexity:null,type:'Task',updated:1,comments:[],commentCount:0,dependencies:0,fields:{},attachments:[]};
const fixture=async()=>{
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),remote=structuredClone(initial),mutations=[],errors=[];
 let hold=false,release,started;const startedRequest=new Promise(resolve=>{started=resolve;});const gate=new Promise(resolve=>{release=resolve;});
 const status={version:'synthetic',connected:true,automaticSyncEnabled:true,youtrackAvailable:true,syncControl:true,connection:{missingStates:[],localAssignedStatus:true,complexity:{ready:true}}};
 const state={version:1,remote:[structuredClone(remote)],operations:[],order:{},images:{},expanded:[],selectorExpanded:[],blocked:null};
 const json=(route,body)=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;
  if(url.origin!=='http://127.0.0.1:3100'){errors.push('External request refused');await route.abort();return;}
  if(path==='/addons/npcdex/index.html'){await route.fulfill({contentType:'text/html',body:`<!doctype html><script>window.romdexWorkspace={kind:'npcdex',ready:Promise.resolve(),status:()=>({label:'NPCDex',cloud:false,connection:'local',automaticRemote:false,localCheckpoint:true,attention:false,message:'Synthetic local provider'}),manualSave:async()=>({ok:true}),checkpoint:async()=>{},resize:()=>{}};</script>`});return;}
  if(path==='/api/status'){await json(route,status);return;}
  if(path==='/api/backup'){await json(route,req.method()==='GET'?state:{ok:true});return;}
  if(path==='/api/comments'){await json(route,{...status,comments:[]});return;}
  if(path==='/api/snapshot'){await json(route,{...status,items:[structuredClone(remote)],at:1});return;}
  if(path==='/api/sync'){
   const body=req.postDataJSON();if(hold){hold=false;started();await gate;}
   const completed=[];let blocked=null;
   for(const op of body.operations){const result=reconcile(op.base,op.patch,remote);if(result.conflicts.length){blocked={opId:op.opId,conflicts:result.conflicts,remote:structuredClone(remote)};break;}mutations.push(structuredClone(op));Object.assign(remote,result.patch);remote.updated++;completed.push(op.opId);}
   await json(route,{...status,completed,mapping:{},blocked,items:[structuredClone(remote)],at:1});return;
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
 await test('desktop UI saves locally while focused, resumes on blur and preserves notes on reload',async()=>{
  const s=await fixture();try{const notes=s.view.locator('#notes');await notes.fill('Before complete note');await s.ready();await s.page.clock.fastForward(60000);assert.equal(s.mutations.length,0);
   await expect(notes).toHaveValue('Before complete note');await expect(s.page.locator('#save')).toHaveAttribute('title',/Text Changes Saved Locally · Leave the Editor or Use Save Changes/);await expect(s.view.locator('.editor-hint')).toContainText('Auto-Sync waits until you leave this editor');
   await s.view.getByRole('button',{name:'Expand Details Tray',exact:true}).click();await s.page.clock.fastForward(2000);await expect.poll(()=>s.remote.description).toBe('Before complete note');assert.equal(s.mutations.length,1);
   await notes.fill('Later local note');await s.ready();await s.page.reload();await s.page.waitForFunction(()=>window.romdexShell?.host.views.size===2&&!window.romdexShell.native.busy);await expect.poll(()=>s.remote.description).toBe('Later local note');assert.deepEqual(s.errors,[]);
  }finally{await s.context.close();}
 });
 await test('desktop UI manual snapshot followed by faster edits never conflicts with its own upload',async()=>{
  const s=await fixture();try{const notes=s.view.locator('#notes');await notes.fill('Before partial');await s.ready();const hold=s.holdNext();await s.page.locator('#save').click();await hold.started;
   await notes.fill('Before partial and completed');await expect.poll(()=>s.page.evaluate(()=>window.romdexShell.native.pendingWrites)).toBe(0);
   hold.release();await s.ready();await expect(notes).toHaveValue('Before partial and completed');
   await s.page.locator('#save').click();await s.ready();await expect.poll(()=>s.remote.description).toBe('Before partial and completed');await expect(s.view.locator('#review-dialog')).not.toBeVisible();assert.equal(s.mutations.length,2);assert.deepEqual(s.errors,[]);
  }finally{await s.context.close();}
 });
 await test('desktop UI keeps the editor baseline across a remote refresh and displays a real conflict',async()=>{
  const s=await fixture();try{const notes=s.view.locator('#notes');await notes.focus();s.remote.description='Before external longer version';s.remote.updated++;
   await s.page.evaluate(async()=>{await window.romdexShell.native.refresh();});await expect(notes).toHaveValue('Before');await notes.fill('Before local continuation');await s.ready();await s.page.locator('#save').click();await s.ready();
   await expect(s.view.locator('#review-dialog')).toBeVisible();await expect(s.view.locator('#review-content')).toContainText('Before external longer version');await expect(s.view.locator('#review-content')).toContainText('Before local continuation');assert.equal(s.mutations.length,0);assert.deepEqual(s.errors,[]);
  }finally{await s.context.close();}
 });
 await test('desktop UI local save failure preserves typed notes and shows the real failure message',async()=>{
  const s=await fixture();try{await s.page.evaluate(()=>{window.romdexShell.native.storage.save=async()=>{throw Error('Synthetic disk full');};});await s.view.locator('#notes').fill('Recovery text after failure');await expect(s.page.locator('#save')).toHaveAttribute('title',/Local Save Failed · Synthetic disk full/);await expect(s.view.locator('#notes')).toHaveValue('Recovery text after failure');assert.equal(s.mutations.length,0);assert.deepEqual(s.errors,[]);
  }finally{await s.context.close();}
 });
}finally{await browser.close();}