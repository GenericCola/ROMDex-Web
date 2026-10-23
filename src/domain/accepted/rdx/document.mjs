import {Buffer} from 'buffer/index.js';
import {parseJSON,canonical,sha,unique,verifyDigest,validateGraph,same,conforms} from '../content/contracts.mjs';
import {checkImageBounds} from '../content/image-bounds.mjs';
import {validateViews} from '../content/view-contract.mjs';
import {validateShape} from './schema.mjs';
import {bounds,ensure} from './limits.mjs';

export const CAPABILITIES=Object.freeze(['org.romdex.rdx.container-v1','org.romdex.rdx.map-v1','org.romdex.rdx.plan-v1','org.romdex.npcdex.content-v1']);
export function requireCapabilities(required){
 ensure(Array.isArray(required),'INVALID','Missing RDX Capabilities.');
 const missing=required.filter(x=>!CAPABILITIES.includes(x));
 ensure(!missing.length,'UNSUPPORTED','Unsupported Required RDX Capabilities: '+missing.join(', '));
}
export function documentRevision(doc){const body={...doc};delete body.revision;return sha(canonical(body));}
const ref=r=>r.recordId+':'+r.revisionId;
function singleMapPayload(value,doc){
 const map=doc.scope.mapRecordId,record=doc.content.records.find(r=>r.recordId===map),view=doc.content.views.find(v=>v.recordId===map),allowed=new Set([map,record?.legacyData?.legacyTownId,view?.payload.fields?.id].filter(Boolean)),todo=[value];
 while(todo.length){const v=todo.pop();if(!v||typeof v!=='object')continue;
  if(v.schema==='NPCDexContentRevision/1'&&v.kind==='map')ensure(v.recordId===map,'INVALID','An RDX Map Cannot Contain Another Map Payload.');
  if(v.format==='RDXDocument/1'&&v.kind==='map')ensure(v.scope?.mapRecordId===map,'INVALID','An RDX Map Cannot Contain Another Map Document.');
  const town=x=>x&&typeof x==='object'&&Array.isArray(x.areas)&&Array.isArray(x.characters);
  if(Array.isArray(v.towns)&&v.towns.some(town))ensure(v.towns.length===1&&allowed.has(v.towns[0]?.id),'INVALID','An RDX Map Cannot Embed a Multi-Map Save or Another Map.');
  if(town(v)&&typeof v.id==='string')ensure(allowed.has(v.id),'INVALID','An RDX Map Cannot Embed Another Map.');
  for(const x of Object.values(v))if(x&&typeof x==='object')todo.push(x);
 }
}
function image(bytes,mime){
 const signature=mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):
  mime==='image/gif'?/^GIF8[79]a$/.test(bytes.subarray(0,6).toString()):
  mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:
  mime==='image/webp'?bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'&&bytes.readUInt32LE(4)+8===bytes.length:false;
 ensure(signature,'INVALID','RDX Image Signature or Type Differs.');checkImageBounds(bytes,mime);
}
function mapModel(doc,history){
 const c=doc.content,scope=doc.scope,records=[...c.records,...history.filter(a=>a.schema==='NPCDexContentRevision/1')];
 unique(c.records.map(ref),'RDX Record Revision');unique(c.recordHeads.map(r=>r.recordId),'RDX Record Head');
 const revisions=new Map(records.map(r=>[ref(r),r]));
 for(const a of [...c.records,...c.mappings,...c.plans,...c.reviews,...c.views]){verifyDigest(a);ensure(a.workspaceId===doc.datasetId,'INVALID','RDX Artifact Dataset Differs.');}
 const heads=c.recordHeads.map(h=>{const r=revisions.get(ref(h));ensure(r,'INVALID','Missing RDX Record Head Revision.');return r;});
 const byId=validateGraph(heads),need=id=>{const r=byId.get(id);ensure(r,'INVALID','Missing RDX Content Reference: '+id);return r;};
 const owned=new Set(scope.ownedRecordIds),context=new Set(scope.contextRecordIds);
 unique([...scope.ownedRecordIds,...scope.contextRecordIds],'RDX Scope Identity');
 ensure(same([...byId.keys()].sort(),[...owned,...context].sort()),'INVALID','RDX Scope Differs From Record Heads.');
 ensure(need(scope.mapRecordId).kind==='map'&&owned.has(scope.mapRecordId)&&heads.filter(r=>r.kind==='map').length===1,'INVALID','RDX Requires One Primary Map.');
 for(const r of heads){
  ensure(['region','profile','shared'].includes(r.kind)?context.has(r.recordId):owned.has(r.recordId),'INVALID','RDX Context and Ownership Differ.');
  const p=r.current.payload;
  for(const id of [p.baseImageId,p.overrides?.imageAssetId].filter(Boolean))ensure(doc.assetInventory.some(a=>a.assetId===id&&a.purpose==='image'),'INVALID','Missing RDX Content Image.');
 }
 for(const r of records)for(const parent of r.parents)ensure(revisions.has(r.recordId+':'+parent),'INVALID','Missing RDX Record Ancestry.');
 const mappings=new Map([...c.mappings,...history.filter(a=>a.schema==='NPCDexROMMapping/1')].map(a=>[a.digest,a]));
 for(const m of mappings.values())for(const locator of m.locators)ensure(!/^(?:[a-z]+:|[\\/])/i.test(locator.path)&&!locator.path.split(/[\\/]/).includes('..')&&!locator.path.includes('\0'),'INVALID','Unsafe RDX Project-Relative ROM Locator.');
 for(const r of records)for(const h of r.mappingRefs)ensure(mappings.get(h)?.recordId===r.recordId,'INVALID','Missing RDX ROM Mapping.');
 for(const p of c.plans)for(const r of [p.baseline,...p.readSet])ensure(revisions.has(ref(r)),'INVALID','Missing RDX Plan Baseline or Read.');
 const viewHistory=new Map(history.filter(a=>a.schema==='NPCDexViewRevision/1').map(v=>[v.digest,v])),views=new Map(c.views.map(v=>[v.digest,v])),pendingViews=[...c.views];
 unique(c.views.map(v=>v.digest),'RDX Presentation Revision');
 while(pendingViews.length){const v=pendingViews.pop();for(const p of v.parents)if(!views.has(p)&&viewHistory.has(p)){views.set(p,viewHistory.get(p));pendingViews.push(viewHistory.get(p));}}
 validateViews({records:heads,revisions:records,views:[...views.values()],assets:doc.assetInventory});
 for(const view of c.views){
  if(view.recordId)ensure(byId.has(view.recordId),'INVALID','Unknown RDX View Record.');
  const pending=[view.payload];while(pending.length){const v=pending.pop();if(!v||typeof v!=='object')continue;
   if(v.format==='NPCDexViewImage/1')ensure(doc.assetInventory.some(a=>a.assetId===v.assetId&&a.purpose==='image'),'INVALID','Missing RDX View Image.');
   else pending.push(...Object.values(v));
  }
 }
 for(const id of scope.completeForParentIds)ensure(owned.has(id)&&['map','subzone'].includes(need(id).kind),'INVALID','Invalid RDX Complete Scope.');
 unique(scope.baselineInventory.map(r=>r.recordId),'RDX Coverage Identity');
 for(const r of scope.baselineInventory)ensure(revisions.get(ref(r))?.parentRecordId===r.parentRecordId,'INVALID','Missing or Different RDX Coverage Base.');
 for(const a of c.archivalRequests)ensure(owned.has(a.recordId)&&revisions.has(a.recordId+':'+a.expectedRevision),'INVALID','Unpinned RDX Archival Request.');
}
function planModel(doc){
 const tasks=doc.content.tasks,byId=new Map(tasks.map(t=>[t.taskId,t]));unique(tasks.map(t=>t.taskId),'RDX Task');unique(doc.content.roots,'RDX Root');
 const tiers=['epic','saga','story','verse','task'];
 ensure(same(doc.content.roots.slice().sort(),tasks.filter(t=>t.parentTaskId===null).map(t=>t.taskId).sort()),'INVALID','RDX Task Roots Differ.');
 const done=new Set();for(const t of tasks){
  let cursor=t;const seen=new Set();while(cursor&&!done.has(cursor.taskId)){ensure(!seen.has(cursor.taskId),'INVALID','RDX Task Hierarchy Cycle.');seen.add(cursor.taskId);const id=cursor.parentTaskId;ensure(!id||byId.has(id),'INVALID','Missing RDX Task Parent.');cursor=id?byId.get(id):null;}for(const id of seen)done.add(id);
  if(t.parentTaskId)ensure(t.declaredTier===tiers[Math.min(4,tiers.indexOf(byId.get(t.parentTaskId).declaredTier)+1)],'INVALID','RDX Declared Task Tiers Differ From Their Hierarchy.');
  unique(t.comments.map(c=>c.commentId),'RDX Comment');unique(t.attachments.map(a=>a.attachmentId),'RDX Attachment');unique(t.fields.map(f=>f.key),'RDX Field');
  for(const a of t.attachments)ensure(doc.assetInventory.some(x=>x.assetId===a.assetId),'INVALID','Missing RDX Task Attachment.');
  for(const f of t.fields)if(f.type==='date'&&f.value!==null)ensure(Number.isFinite(Date.parse(f.value+'T00:00:00.000Z'))&&new Date(f.value+'T00:00:00.000Z').toISOString().slice(0,10)===f.value,'INVALID','Invalid RDX Calendar Date.');
 }
 for(const d of doc.content.deletionRequests)ensure(byId.get(d.taskId)?.baseRevision===d.expectedRevision,'INVALID','Unpinned RDX Task Deletion.');
}
export function validateDocument(bytes,{blobs=new Map(),limits:overrides,check=()=>{}}={}){
 const limits=bounds(overrides);ensure(blobs instanceof Map&&blobs.size+1<=limits.entries,'LIMIT','RDX Entry Count Limit Exceeded.');
 let total=bytes.length;for(const data of blobs.values()){ensure(Buffer.isBuffer(data)&&data.length<=limits.blob,'LIMIT','RDX Binary Entry Limit Exceeded.');total+=data.length;ensure(total<=limits.decoded,'LIMIT','RDX Decoded Aggregate Limit Exceeded.');}
 const doc=parseJSON(bytes,{maxBytes:limits.json,maxDepth:limits.depth,maxNodes:limits.nodes});check();
 ensure(doc?.format==='RDXDocument/1'&&doc.schemaVersion===1&&((doc.namespace==='org.romdex.npcdex'&&doc.kind==='map')||(doc.namespace==='org.romdex.tasks'&&doc.kind==='plan')),'UNSUPPORTED','Unsupported RDX Document Version, Workspace or Kind.');
 requireCapabilities(doc.capabilities?.required);validateShape(doc,doc.kind==='map'?'mapDocument':'planDocument');
 ensure(doc.revision===documentRevision(doc),'INVALID','RDX Document Revision Differs.');
 if(doc.kind==='map')singleMapPayload(doc,doc);
 ensure(!doc.parents.includes(doc.revision),'INVALID','RDX Document Is Its Own Parent.');
 ensure(Number.isFinite(Date.parse(doc.createdAt))&&new Date(doc.createdAt).toISOString()===doc.createdAt,'INVALID','Invalid RDX Creation Time.');
 unique(doc.assetInventory.map(a=>a.assetId),'RDX Asset Identity');
 const hashes=new Set(),history=[],historyTypes=new Map();
 for(const a of doc.assetInventory){
  check();const data=blobs.get(a.sha256);ensure(Buffer.isBuffer(data)&&data.length===a.bytes&&sha(data)===a.sha256,'INVALID','Missing or Corrupt RDX Blob: '+a.sha256);
  ensure(data.length<=limits.blob,'LIMIT','RDX Binary Entry Limit Exceeded.');hashes.add(a.sha256);
  if(a.purpose==='image')image(data,a.mime);
  if(a.purpose==='history'||a.mime==='application/json'){
   const old=parseJSON(data,{maxBytes:limits.json,maxDepth:limits.depth,maxNodes:limits.nodes});
   if(doc.kind==='map')singleMapPayload(old,doc);
   if(a.purpose==='history'){
    historyTypes.set(a.sha256,old.format||old.schema);
    if(old.format==='RDXDocument/1'){requireCapabilities(old.capabilities?.required);validateShape(old,old.kind==='map'?'mapDocument':'planDocument');ensure(old.revision===documentRevision(old)&&old.datasetId===doc.datasetId,'INVALID','RDX History Document Differs.');const artifacts=[...(old.content.records||[]),...(old.content.mappings||[]),...(old.content.views||[])];for(const value of artifacts){verifyDigest(value);ensure(value.workspaceId===doc.datasetId,'INVALID','RDX History Dataset Differs.');}history.push(...artifacts);}
    else {ensure(conforms(old),'INVALID','Unsupported RDX History Artifact.');verifyDigest(old);ensure(old.workspaceId===doc.datasetId,'INVALID','RDX History Dataset Differs.');history.push(old);}
   }
  }
 }
 ensure(blobs.size===hashes.size&&[...blobs.keys()].every(h=>hashes.has(h)),'INVALID','Unlisted RDX Blob.');
 if(doc.kind==='map'){
  for(const h of doc.content.history)ensure(doc.assetInventory.some(a=>a.sha256===h.sha256&&a.purpose==='history'&&a.mime===h.mediaType)&&historyTypes.get(h.sha256)===h.schema,'INVALID','Missing or Mismatched Typed RDX History.');
  mapModel(doc,history);
 }else planModel(doc);
 check();return {document:doc,canonicalBytes:Buffer.from(canonical(doc)),requiresHumanTesting:doc.origin.role==='agent-result',authorization:'not-established'};
}
