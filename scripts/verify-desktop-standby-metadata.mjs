import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(process.argv[2]||'artifacts/desktop-standby-metadata-candidate');
const core=await import(pathToFileURL(resolve(root,'public/core.mjs')));
const web=await import('../src/domain/accepted/core.mjs');
const {YouTrack}=await import(pathToFileURL(resolve(root,'youtrack.mjs')));
const {GitHubSaveStore}=await import(pathToFileURL(resolve(root,'cloud/github-store.mjs')));

test('desktop and web apply the same Standby threshold and all precedence combinations',()=>{
 const colors=Object.keys(core.STATES);for(const a of colors)for(const b of colors)for(const c of colors)assert.equal(core.rollup([a,b,c]),web.rollup([a,b,c]));
 for(const n of [0,1,2,3,10])assert.equal(core.rollup(Array(n).fill('blue')),n===0?null:n===1?'yellow':'blue');
 for(const other of colors.filter(x=>x!=='blue'))assert.equal(core.rollup(['blue',other]),web.rollup(['blue',other]));
});
test('desktop delivery crosses the two-child threshold and restores assignments without network access',async()=>{
 const item=(id,state,parentId=null)=>({id,state,assignedState:state,parentId,summary:id,updated:1});
 const tasks=[item('PMON-900000','To do'),item('PMON-900001','In Development','PMON-900000'),item('PMON-900002','Standby','PMON-900001'),item('PMON-900003','Standby','PMON-900001')],writes=[];
 const yt=new YouTrack('synthetic-token');yt.request=async()=>{throw Error('No network allowed');};yt.all=async()=>structuredClone(tasks);yt.writeEffectiveState=async(id,state)=>{tasks.find(x=>x.id===id).state=state;writes.push({id,state});};
 await yt.derivedStatuses();assert.equal(tasks[1].state,'Standby');assert.equal(tasks[0].state,'In Progress');assert.equal(tasks[1].assignedState,'In Development');
 const count=writes.length;await yt.derivedStatuses();assert.equal(writes.length,count);
 tasks[3].parentId=null;await yt.derivedStatuses();assert.equal(tasks[1].state,'In Progress');assert.equal(tasks[0].state,'In Progress');
 tasks[2].parentId=null;await yt.derivedStatuses();assert.equal(tasks[1].state,'In Development');assert.equal(tasks[0].state,'In Development');
});
test('only the owner and explicitly approved collaborator pass; privacy and authorization failures still stop publication',async()=>{
 const connection={format:'ROMDexGitHubCloudConnection/1',bootstrap:{provider:{owner:'GenericCola',repository:'ROMDex-Data',repositoryId:'1421625633',ownerId:'32021766',branch:'main'},owner:{githubUserId:'32021766'},workspaceId:'1e267c45-75ae-48a9-b173-5ca3132bb121'},bootstrapPath:'workspaces/1e267c45-75ae-48a9-b173-5ca3132bb121/bootstrap.json',bootstrapSha256:'e47be8ff64715f5473289f1d1e336c4d7b512644660667e1b1ff1dd639bb25c4'};
 for(const kind of ['owner','approved','outsider','public','denied','paged','wrong-owner']){
  let reachedHead=false;const store=new GitHubSaveStore({connection,credential:()=>{throw Error('No credential access');},request:async(route,options={})=>{
   assert.ok(!options.method||options.method==='GET');
   if(route==='/user')return {status:200,data:{id:'32021766'}};
   if(route.endsWith('/collaborators?per_page=100'))return {status:kind==='denied'?403:200,next:kind==='paged',data:(kind==='owner'?['32021766']:kind==='outsider'?['32021766','999']:['32021766','58527382']).map(id=>({id}))};
   return {status:200,data:{id:'1421625633',private:kind!=='public',owner:{id:kind==='wrong-owner'?'999':'32021766'}}};
  }});store.head=async()=>{reachedHead=true;throw Error('identity checks passed; history verification still required');};
  await assert.rejects(store.verifyAccess(),['owner','approved'].includes(kind)?/identity checks passed/:/Authorization Review|Repository Changed/);
  assert.equal(reachedHead,['owner','approved'].includes(kind),kind);
 }
});
