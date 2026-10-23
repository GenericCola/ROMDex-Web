import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(process.argv[2]||'artifacts/desktop-notes-fix/patched');
const {WorkspaceEngine}=await import(pathToFileURL(resolve(root,'workspace-engine.mjs')));
const {reconcile}=await import(pathToFileURL(resolve(root,'core.mjs')));
const task=()=>({id:'PMON-900001',summary:'Synthetic Notes Task',description:'Before',state:'To do',assignedState:'To do',parentId:null,updated:1,comments:[],commentCount:0});
const fixture=()=>{
 const remote=task(),sent=[],local=[],hooks={status:async()=>{}};let waiting=false,release,started;
 const began=new Promise(resolve=>{started=resolve;});const hold=new Promise(resolve=>{release=resolve;});
 const status={connected:true,automaticSyncEnabled:true,youtrackAvailable:true,syncControl:true,connection:{missingStates:[]}};
 const engine=new WorkspaceEngine({storage:{load:async()=>undefined,save:async state=>{local.push(structuredClone(state));}},transport:async(path,body)=>{
  if(path==='/api/status'){await hooks.status();return status;}
  if(path==='/api/sync-settings'){status.automaticSyncEnabled=body.enabled;return status;}
  if(path!=='/api/sync')throw Error('Unexpected fixture request '+path);
  sent.push(structuredClone(body));if(waiting){waiting=false;started();await hold;}
  const completed=[];let blocked=null;
  for(const op of body.operations){const result=reconcile(op.base,op.patch,remote);if(result.conflicts.length){blocked={opId:op.opId,conflicts:result.conflicts};break;}Object.assign(remote,result.patch);remote.updated++;completed.push(op.opId);}
  return {...status,completed,mapping:{},blocked,items:[structuredClone(remote)],at:1};
 }});
 engine.state={version:1,remote:[task()],operations:[],order:{},images:{},expanded:[],selectorExpanded:[],blocked:null};engine.applyStatus(status);
 return {engine,remote,sent,local,hooks,holdNext:()=>{waiting=true;return {began,release};}};
};
test('notes edited during an in-flight snapshot keep the predecessor baseline and never self-conflict',async()=>{
 for(const final of ['Before longer notes','Replacement text','']){
  const s=fixture();await s.engine.edit(s.remote.id,{description:'Before partial'});
  const hold=s.holdNext(),running=s.engine.sync(true);await hold.began;
  await s.engine.edit(s.remote.id,{description:final},{description:'Before'});hold.release();await running;
  assert.equal(s.engine.items[0].description,final);assert.equal(s.engine.state.operations[0].base.description,'Before partial');
  await s.engine.sync(true);assert.equal(s.engine.state.blocked,null);assert.equal(s.remote.description,final);assert.equal(s.engine.state.operations.length,0);
 }
});
test('text focus holds automatic requests but manual Save is explicit and blur releases delivery',async()=>{
 const s=fixture();s.engine.setTextEditing('notes',true);await s.engine.edit(s.remote.id,{description:'Local full note'});
 await s.engine.sync();await s.engine.tick(true);assert.equal(s.sent.length,0);assert.equal(s.local.at(-1).operations[0].patch.description,'Local full note');
 assert.equal(s.engine.message,'Text Changes Saved Locally · Leave the Editor or Use Save Changes');
 await s.engine.sync(true);assert.equal(s.remote.description,'Local full note');
 await s.engine.edit(s.remote.id,{description:'Later note'});await s.engine.sync();assert.equal(s.sent.length,1);
 s.engine.setTextEditing('notes',false);await s.engine.sync();assert.equal(s.remote.description,'Later note');
});
test('a real remote note edit still requires review even when one version is longer',async()=>{
 for(const external of ['Before partial external continuation','Remote replacement','']){
  const s=fixture();await s.engine.edit(s.remote.id,{description:'Before partial'});
  const hold=s.holdNext(),running=s.engine.sync(true);await hold.began;
  await s.engine.edit(s.remote.id,{description:'Before partial local continuation'},{description:'Before'});hold.release();await running;
  s.remote.description=external;await s.engine.sync(true);assert.equal(s.engine.state.blocked?.conflicts[0].field,'description');assert.equal(s.remote.description,external);assert.equal(s.engine.items[0].description,'Before partial local continuation');
 }
});
test('the native bridge supports only a validated editor key and boolean hold',async()=>{
 const {DesktopWorkspace}=await import(pathToFileURL(resolve(root,'desktop-workspace.mjs')));
 const {validateCall}=await import(pathToFileURL(resolve(root,basename(root)==='public'?'../desktop/policy.mjs':'desktop/policy.mjs')));
 const s=fixture(),native=new DesktopWorkspace({onEvent:()=>{},call:async(method,args)=>{validateCall(method,args);return {value:await s.engine[method](...args)};}});
 await native.setTextEditing('notes',true);await s.engine.edit(s.remote.id,{description:'Native bridge note'});await native.sync();assert.equal(s.sent.length,0);
 await native.setTextEditing('notes',false);await native.sync();assert.equal(s.remote.description,'Native bridge note');
 assert.throws(()=>validateCall('setTextEditing',['notes','true']),/Unsupported Text Editor/);assert.throws(()=>validateCall('setTextEditing',['unknown',true]),/Unsupported Text Editor/);
});
test('automatic delivery rechecks text focus after status preparation',async()=>{
 const s=fixture();await s.engine.edit(s.remote.id,{description:'Before partial'});
 s.hooks.status=async()=>{s.engine.setTextEditing('notes',true);await s.engine.edit(s.remote.id,{description:'Before full note'});};
 await s.engine.sync();assert.equal(s.sent.length,0);assert.equal(s.engine.items[0].description,'Before full note');
 await s.engine.setAutomaticSync(true);assert.equal(s.sent.length,0);
 s.hooks.status=async()=>{};s.engine.setTextEditing('notes',false);await s.engine.sync();assert.equal(s.remote.description,'Before full note');
});

test('automatic delivery rechecks text focus after asynchronous file preparation',async()=>{
 const s=fixture();await s.engine.edit(s.remote.id,{description:'Before partial'});let first=true;
 s.engine.stageUploads=async()=>{if(first){first=false;s.engine.setTextEditing('notes',true);await s.engine.edit(s.remote.id,{description:'Before complete'});}};
 await s.engine.sync();assert.equal(s.sent.length,0);assert.equal(s.engine.items[0].description,'Before complete');
 s.engine.setTextEditing('notes',false);await s.engine.sync();assert.equal(s.remote.description,'Before complete');assert.equal(s.engine.state.blocked,null);
});
