import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve,extname} from 'node:path';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.playwright-browsers');
const {chromium,expect}=await import('@playwright/test');
const root=resolve(process.argv[2]||'artifacts/desktop-status-dialog/patched');
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
 await page.addInitScript(()=>{
  if(window.top!==window)return;
  const state=window.guardFixture={pending:[],calls:[],head:'synthetic-head',active:true},listeners=new Set(),stores=new Map();
  const keys=['state','busy','refreshing','connected','connection','rememberedConnection','mode','message','failures','pendingWrites','automaticSyncEnabled','youtrackAvailable','serviceAvailable','syncControl','settingBusy','manualSyncActive','lastAttempt'];
  const snapshot=engine=>({...Object.fromEntries(keys.map(key=>[key,engine[key]])),inflight:[...engine.inflight],metadataCloud:{active:state.active,projectedHead:state.head,label:'ROMDex Metadata',cloud:true,automaticRemote:true,pending:0,connection:'connected',message:'Synthetic metadata fixture'}});
  const ready=import('/store.mjs').then(({Workspace})=>{const engine=window.fixtureEngine=new Workspace();for(const type of ['change','mapping','refreshed','connectneeded','reviewneeded'])engine.addEventListener(type,event=>{for(const listener of listeners)listener(type==='change'?{type:'snapshot',value:snapshot(engine)}:{type,detail:event.detail});});return engine;});
  window.romdexDesktop={
   onEvent:listener=>listeners.add(listener),profileInfo:async()=>({migrated:true}),trayState:async()=>true,rdxOpen:async()=>[],
   storage:async(mode,key,value)=>{if(mode==='load')return stores.get(key);stores.set(key,value);return true;},
   call:async(method,args=[])=>{if(method==='metadataEditorState'){state.calls.push({method,args});if(args[0].active)return new Promise((resolve,reject)=>state.pending.push({resolve,reject}));return true;}const engine=await ready;if(method==='checkpoint'){await engine.lock;return true;}if(method==='metadataView'||method==='metadataSync')return {status:snapshot(engine).metadataCloud};if(typeof engine[method]!=='function')throw Error('Unexpected synthetic desktop command: '+method);const value=await engine[method](...args);return {value,snapshot:snapshot(engine)};}
  };
 });
 page.on('pageerror',error=>errors.push(error.message));await page.clock.install();await page.goto('http://127.0.0.1:3100/index.html');
 await page.waitForFunction(()=>window.romdexShell?.host.views.size===2&&!window.romdexShell.native.busy);const view=page.frame({url:/tasks.html/});
 await view.getByRole('button',{name:'Synthetic Notes Task',exact:true}).click();await expect(view.locator('#notes')).toBeVisible();
 const ready=async()=>expect.poll(()=>page.evaluate(()=>{const w=window.romdexShell.native;return w.pendingWrites===0&&!w.busy;})).toBe(true);
 return {context,page,view,remote,mutations,errors,ready,holdNext:()=>{hold=true;return {started:startedRequest,release};}};
};
const guardedFixture=fixture;
try{
 await test('Status X remains clickable while metadata preparation is delayed',async()=>{
 const s=await guardedFixture();try{await s.view.locator('#detail-state').click();const dialog=s.view.locator('#status-dialog');await expect(dialog).toBeVisible();await expect.poll(()=>s.view.evaluate(()=>window.parent.guardFixture.calls.length)).toBe(1);const noticeBox=await dialog.locator('[data-metadata-editor-wait]').boundingBox(),dialogBox=await dialog.boundingBox();assert.ok(noticeBox.y>=dialogBox.y&&noticeBox.y+noticeBox.height<=dialogBox.y+dialogBox.height);await s.page.screenshot({path:resolve('artifacts/desktop-status-dialog/preparing.png')});await dialog.getByRole('button',{name:'Close Status Menu',exact:true}).click({timeout:800});await expect(dialog).not.toBeVisible();await s.view.evaluate(()=>window.parent.guardFixture.pending.shift().resolve(true));await expect.poll(()=>s.view.evaluate(()=>window.parent.guardFixture.calls.filter(call=>!call.args[0].active).length)).toBe(1);assert.deepEqual(s.mutations,[]);assert.deepEqual(s.errors,[]);}finally{await s.context.close();}
 });

 await test('Status stays protected until acknowledgement, then edits locally during an in-flight YouTrack save',async()=>{
 const s=await guardedFixture();let sync,gate;try{
 gate=s.holdNext();sync=s.page.evaluate(()=>window.romdexShell.native.sync(true));await gate.started;await s.view.locator('#detail-state').click();const dialog=s.view.locator('#status-dialog');await expect(dialog.locator('[data-metadata-editor-wait]')).toHaveText('Preparing this editor. Waiting for the current save to finish…');await expect(dialog).toHaveAttribute('aria-busy','true');assert.equal(await dialog.locator('[data-status-color="blue"]').evaluate(el=>el.inert),true);
 await assert.rejects(()=>dialog.locator('[data-status-color="blue"]').click({timeout:200}),/Timeout/);assert.equal(await s.page.evaluate(()=>window.romdexShell.native.state.operations.length),0);
 await s.view.evaluate(()=>window.parent.guardFixture.pending.shift().resolve(true));await expect(dialog.locator('[data-metadata-editor-wait]')).toHaveCount(0);await dialog.getByRole('button',{name:'Standby',exact:true}).click();await expect(dialog).not.toBeVisible();await expect.poll(()=>s.page.evaluate(()=>window.romdexShell.native.state.operations.find(op=>op.patch?.assignedState)?.patch.assignedState)).toBe('Standby');assert.equal(await s.page.evaluate(()=>window.romdexShell.native.busy),true);
 gate.release();await sync;await expect.poll(()=>s.page.evaluate(()=>window.romdexShell.native.items.find(item=>item.id==='PMON-900001').assignedState)).toBe('Standby');assert.deepEqual(s.mutations,[]);assert.deepEqual(s.errors,[]);
 }finally{gate?.release();await sync?.catch(()=>{});await s.context.close();}
 });
 await test('Escape cancels preparation and a late reply cannot unlock a newer Status opening',async()=>{
 const s=await guardedFixture();try{await s.view.locator('#detail-state').click();const dialog=s.view.locator('#status-dialog');await s.page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await s.view.locator('#detail-state').click();await s.view.evaluate(()=>window.parent.guardFixture.pending.shift().resolve(true));await expect.poll(()=>s.view.evaluate(()=>window.parent.guardFixture.pending.length)).toBe(1);await expect(dialog).toHaveAttribute('aria-busy','true');assert.equal(await dialog.locator('[data-status-color="blue"]').evaluate(el=>el.inert),true);await s.view.evaluate(()=>window.parent.guardFixture.pending.shift().resolve(true));await expect(dialog.locator('[data-metadata-editor-wait]')).toHaveCount(0);await dialog.getByRole('button',{name:'Close Status Menu',exact:true}).click();await expect.poll(()=>s.view.evaluate(()=>window.parent.guardFixture.calls.filter(call=>!call.args[0].active).length)).toBe(1);assert.deepEqual(s.errors,[]);}finally{await s.context.close();}
 });
 await test('an excessive preparation wait exits safely with the real shell message and releases a late hold',async()=>{
 const s=await guardedFixture();try{await s.view.locator('#detail-state').click();const dialog=s.view.locator('#status-dialog');await s.page.clock.fastForward(15001);await expect(dialog).not.toBeVisible();await expect(s.page.locator('#shell-status')).toHaveText('The editor could not finish opening. No changes were made. Wait for the current save to finish, then try again.');await expect(s.page.locator('#shell-status')).toBeVisible();await s.view.evaluate(()=>window.parent.guardFixture.pending.shift().resolve(true));await expect.poll(()=>s.view.evaluate(()=>window.parent.guardFixture.calls.filter(call=>!call.args[0].active).length)).toBe(1);assert.equal(await s.page.evaluate(()=>window.romdexShell.native.state.operations.length),0);assert.deepEqual(s.errors,[]);}finally{await s.context.close();}
 });
 await test('stale metadata refusal is shown through the shell and a fresh opening becomes editable',async()=>{
 const s=await guardedFixture();try{await s.view.locator('#detail-state').click();const dialog=s.view.locator('#status-dialog');await s.view.evaluate(()=>window.parent.guardFixture.pending.shift().reject(Error('ROMDex Metadata Updated While Opening This Editor. Reopen It to Use the Current Version.')));await expect(dialog).not.toBeVisible();await expect(s.page.locator('#shell-status')).toHaveText('ROMDex Metadata Updated While Opening This Editor. Reopen It to Use the Current Version.');await s.view.locator('#detail-state').click();await expect.poll(()=>s.view.evaluate(()=>window.parent.guardFixture.pending.length)).toBe(1);await s.view.evaluate(()=>window.parent.guardFixture.pending.shift().resolve(true));await expect(dialog.locator('[data-metadata-editor-wait]')).toHaveCount(0);await dialog.getByRole('button',{name:'Close Status Menu',exact:true}).click();assert.deepEqual(s.mutations,[]);assert.deepEqual(s.errors,[]);}finally{await s.context.close();}
 });
 await test('dynamic controls stay gated, existing inert state survives, and Cancel remains available',async()=>{
 const s=await guardedFixture();try{await s.view.evaluate(()=>{const dialog=document.getElementById('status-dialog'),control=document.createElement('input');control.id='already-inert';control.inert=true;dialog.append(control);});await s.view.locator('#detail-state').click();await s.view.evaluate(()=>{const input=document.createElement('input');input.id='late-control';document.getElementById('status-dialog').append(input);});await expect.poll(()=>s.view.locator('#late-control').evaluate(el=>el.inert)).toBe(true);await s.view.evaluate(()=>window.parent.guardFixture.pending.shift().resolve(true));assert.equal(await s.view.locator('#late-control').evaluate(el=>el.inert),false);assert.equal(await s.view.locator('#already-inert').evaluate(el=>el.inert),true);await s.view.locator('#status-dialog').getByRole('button',{name:'Close Status Menu',exact:true}).click();assert.equal(await s.view.locator('#already-inert').evaluate(el=>el.inert),true);assert.deepEqual(s.errors,[]);}finally{await s.context.close();}
 });
 await test('cancelled queued openings are skipped and metadata deactivation does not strand the hold',async()=>{
 const s=await guardedFixture();try{const dialog=s.view.locator('#status-dialog');await s.view.locator('#detail-state').click();await dialog.getByRole('button',{name:'Close Status Menu',exact:true}).click();await s.view.locator('#detail-state').click();await dialog.getByRole('button',{name:'Close Status Menu',exact:true}).click();await s.view.evaluate(()=>{window.parent.guardFixture.active=false;window.parent.fixtureEngine.emit();window.parent.guardFixture.pending.shift().resolve(true);});await expect.poll(()=>s.view.evaluate(()=>window.parent.guardFixture.calls.filter(call=>!call.args[0].active).length)).toBeGreaterThan(0);assert.equal(await s.view.evaluate(()=>window.parent.guardFixture.calls.filter(call=>call.args[0].active).length),1);assert.deepEqual(s.errors,[]);}finally{await s.context.close();}
 });

 await test('a dynamically added Cancel button remains clickable before acknowledgement',async()=>{
 const s=await guardedFixture();try{await s.view.locator('#detail-state').click();await s.view.evaluate(()=>{const cancel=document.createElement('button');cancel.dataset.close='status-dialog';cancel.textContent='Cancel';document.getElementById('status-dialog').append(cancel);});const dialog=s.view.locator('#status-dialog');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog).not.toBeVisible();await s.view.evaluate(()=>window.parent.guardFixture.pending.shift().resolve(true));await expect.poll(()=>s.view.evaluate(()=>window.parent.guardFixture.calls.filter(call=>!call.args[0].active).length)).toBe(1);assert.deepEqual(s.errors,[]);}finally{await s.context.close();}
 });
 await test('local status editing has no metadata wait when cloud metadata is inactive',async()=>{
 const s=await guardedFixture();try{await s.page.evaluate(()=>{window.guardFixture.active=false;window.fixtureEngine.emit();});await s.view.locator('#detail-state').click();const dialog=s.view.locator('#status-dialog');await expect(dialog.locator('[data-metadata-editor-wait]')).toHaveCount(0);await dialog.getByRole('button',{name:'Standby',exact:true}).click();await expect(dialog).not.toBeVisible();assert.equal(await s.page.evaluate(()=>window.guardFixture.calls.length),0);await expect.poll(()=>s.page.evaluate(()=>window.romdexShell.native.items.find(item=>item.id==='PMON-900001').assignedState)).toBe('Standby');assert.deepEqual(s.errors,[]);}finally{await s.context.close();}
 });

 await test('desktop service failure is displayed and a cancelled retry does not make an edit',async()=>{
 const s=await guardedFixture();try{await s.view.locator('#detail-state').click();const dialog=s.view.locator('#status-dialog');await s.view.evaluate(()=>window.parent.guardFixture.pending.shift().reject(Error('The Desktop Service Did Not Respond. Review Before Retrying.')));await expect(dialog).not.toBeVisible();await expect(s.page.locator('#shell-status')).toHaveText('The Desktop Service Did Not Respond. Review Before Retrying.');await expect(s.page.locator('#shell-status')).toBeVisible();await s.view.locator('#detail-state').click();await dialog.getByRole('button',{name:'Close Status Menu',exact:true}).click();await s.view.evaluate(()=>window.parent.guardFixture.pending.shift().resolve(true));await expect(dialog).not.toBeVisible();assert.equal(await s.page.evaluate(()=>window.romdexShell.native.state.operations.length),0);assert.deepEqual(s.errors,[]);}finally{await s.context.close();}
 });
}finally{await browser.close();}
