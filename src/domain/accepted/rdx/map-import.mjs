import {Buffer} from 'buffer/index.js';
import {canonical,parseJSON,sha,same,seal} from '../content/contracts.mjs';
import {validateDomain} from '../content/materialize.mjs';
import {viewHeads} from '../content/view-contract.mjs';
import {documentRevision,validateDocument} from './document.mjs';
import {ensure} from './limits.mjs';

const hash=a=>a.revisionId||a.digest;
const union=(a,b,key=hash)=>[...new Map([...a,...b].map(v=>[key(v),v])).values()];
const ref=r=>({recordId:r.recordId,revisionId:r.revisionId});
// History bodies are already bounded and validated by the container reader.
export function mapDomain(value){
 const d=value.document,c=d.content,history=[];
 for(const a of d.assetInventory.filter(a=>a.purpose==='history')){const old=parseJSON(value.blobs.get(a.sha256));if(old.format==='RDXDocument/1')history.push(...old.content.records||[],...old.content.mappings||[],...old.content.views||[]);else history.push(old);}
 const revisions=union(history.filter(a=>a.schema==='NPCDexContentRevision/1'),c.records),byHash=new Map(revisions.map(r=>[r.revisionId,r]));
 return validateDomain({records:c.recordHeads.map(r=>byHash.get(r.revisionId)),revisions,mappings:union(history.filter(a=>a.schema==='NPCDexROMMapping/1'),c.mappings),plans:c.plans,reviews:c.reviews,views:union(history.filter(a=>a.schema==='NPCDexViewRevision/1'),c.views),assets:d.assetInventory});
}
export function retainDocument(doc,blobs,value){
 const digest=sha(value.documentBytes),assetId='history:rdx-'+digest;
 if(!doc.assetInventory.some(a=>a.assetId===assetId))doc.assetInventory.push({assetId,sha256:digest,bytes:value.documentBytes.length,mime:'application/json',purpose:'history'});
 blobs.set(digest,value.documentBytes);
 if(!doc.content.history.some(h=>h.sha256===digest))doc.content.history.push({sha256:digest,mediaType:'application/json',schema:'RDXDocument/1',purpose:'Exact Imported Document'});
}
function ancestor(all,a,b){const seen=new Set(),todo=[b];while(todo.length){const id=todo.pop();if(id===a)return true;if(seen.has(id))continue;seen.add(id);todo.push(...(all.get(id)?.parents||[]));}return false;}
function mergeField(base,local,incoming){
 if(same(local,incoming))return {value:local};if(same(local,base))return {value:incoming};if(same(incoming,base))return {value:local};
 if([base,local,incoming].every(v=>v&&typeof v==='object'&&!Array.isArray(v))){const value={};for(const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(incoming)])){
  // Missing keys are distinct from JSON null. Conflicting additions/removals need review.
  if(![base,local,incoming].every(v=>Object.hasOwn(v,key))){const b=Object.hasOwn(base,key),l=Object.hasOwn(local,key),r=Object.hasOwn(incoming,key);if(l===r&&(!l||same(local[key],incoming[key]))){if(l)value[key]=local[key];}else if(l===b&&(!b||same(local[key],base[key]))){if(r)value[key]=incoming[key];}else if(r===b&&(!b||same(incoming[key],base[key]))){if(l)value[key]=local[key];}else return {conflict:true};
  }else{const v=mergeField(base[key],local[key],incoming[key]);if(v.conflict)return v;value[key]=v.value;}
 }return {value};}return {conflict:true};
}
function revision(template,parents,current,operation){return seal({...template,operationId:operation,actorClaim:'content:local-owner',parents:[...new Set(parents)].sort(),current});}

// A pure preview: no filesystem, transport, publication or authority is acquired.
// Choices select observed alternatives; every original remains in portable history.
export function previewMapImport(incoming,local=null,{choices={},archive=[]}={}){
 const source=incoming.document;ensure(source.kind==='map','WORKSPACE','This File Contains a ROMDex Plan. Use the Task Plan Importer.');
 ensure(source.origin.role!=='agent-result','REVIEW_REQUIRED','Agent Results Require the Task Reconciliation Workflow and Human Testing. This File Was Not Applied.');
 const keyOf=d=>d.datasetId+':'+d.documentId;
 if(local)ensure(keyOf(local.document)===keyOf(source)&&local.document.scope.mapRecordId===source.scope.mapRecordId,'CONFLICT','This File Refers to a Different Map Identity.');
 const remote=mapDomain(incoming),here=local?mapDomain(local):null,items=[],conflicts=[],candidates=[];
 const baseline=local?.document.revision||null,token=sha(canonical({source:source.revision,baseline,choices,archive}));
 const operation='content:rdx-import-'+token.slice(0,24),doc=structuredClone(local?.document||source),blobs=new Map([...(local?.blobs||[]),...incoming.blobs]);
 if(!local)return {document:doc,blobs,preview:{token,baseline,sourceRevision:source.revision,mode:'new',items:remote.records.map(r=>({id:r.recordId,kind:r.kind,name:r.current.payload.name||r.recordId,action:source.scope.contextRecordIds.includes(r.recordId)?'Add Context':'Add'})),conflicts,candidates,requiresHumanTesting:true,unbound:true}};
 const assets=new Map(doc.assetInventory.map(a=>[a.assetId,a]));for(const a of source.assetInventory){ensure(!assets.has(a.assetId)||same(assets.get(a.assetId),a),'CONFLICT','An Immutable Asset Identity Has Different Bytes: '+a.assetId);if(!assets.has(a.assetId)){assets.set(a.assetId,a);doc.assetInventory.push(a);}}
 doc.content.history=union(doc.content.history,source.content.history,a=>a.sha256);retainDocument(doc,blobs,incoming);
 const revisions=union(here.revisions,remote.revisions),all=new Map(revisions.map(r=>[r.revisionId,r])),heads=new Map(here.records.map(r=>[r.recordId,r])),context=new Set(source.scope.contextRecordIds);
 const choose=(id,l,r,reason)=>{const selected=choices[id];ensure(selected===undefined||['local','incoming'].includes(selected),'INVALID','Invalid Import Choice.');conflicts.push({id,reason,local:l,incoming:r,choice:selected||null});return selected==='incoming'?r:l;};
 for(const [id,value]of Object.entries(source.extensions)){if(!Object.hasOwn(doc.extensions,id))doc.extensions[id]=value;else if(!same(doc.extensions[id],value))doc.extensions[id]=choose('extensions:'+id,doc.extensions[id],value,'Workspace Extension Has Different Values');}
 for(const key of ['required','optional'])doc.capabilities[key]=[...new Set([...doc.capabilities[key],...source.capabilities[key]])];
 for(const r of remote.records){const l=heads.get(r.recordId);let next=r,action='Add';
  if(l){ensure(l.kind===r.kind&&l.parentRecordId===r.parentRecordId,'CONFLICT','An Existing Record Cannot Change Kind or Parent Through Map Import.');
   if(l.revisionId===r.revisionId){next=l;action='Unchanged';}
   else if(ancestor(all,r.revisionId,l.revisionId)){next=l;action='Keep Newer Local';}
   else if(context.has(r.recordId)){next=choose(r.recordId,l,r,'Shared Context Requires an Explicit Choice');action='Review Context';}
   else if(ancestor(all,l.revisionId,r.revisionId)){next=r;action='Update';}
   else {const bases=revisions.filter(b=>b.recordId===r.recordId&&ancestor(all,b.revisionId,l.revisionId)&&ancestor(all,b.revisionId,r.revisionId)),latest=bases.filter(b=>!bases.some(a=>a.revisionId!==b.revisionId&&ancestor(all,b.revisionId,a.revisionId)));const base=latest.length===1?latest[0]:null;
    const stable=base&&[l,r].every(a=>same(a.mappingRefs,base.mappingRefs)&&same(a.legacyRefs,base.legacyRefs)&&same(a.legacyData,base.legacyData)),merged=stable?mergeField(base.current,l.current,r.current):{conflict:true};
    if(!merged.conflict){next=revision(l,[l.revisionId,r.revisionId],merged.value,operation+':merge-'+sha(r.recordId).slice(0,16));revisions.push(next);action='Merge Independent Changes';}
    else{next=choose(r.recordId,l,r,base?'Overlapping Record Changes':'No Exact Common Record Baseline');action='Review Record';}
   }
   if(choices[r.recordId]){next=revision(next,[l.revisionId,r.revisionId],next.current,operation+':review-'+sha(r.recordId).slice(0,16));revisions.push(next);}
  }heads.set(r.recordId,next);items.push({id:r.recordId,kind:r.kind,name:r.current.payload.name||r.recordId,action});
 }
 const incomingIds=new Set(remote.records.map(r=>r.recordId)),coverage=new Map(source.scope.baselineInventory.map(r=>[r.recordId,r]));
 for(const r of here.records)if(!incomingIds.has(r.recordId)){
  items.push({id:r.recordId,kind:r.kind,name:r.current.payload.name||r.recordId,action:'Retain Omitted Record'});
  const pin=coverage.get(r.recordId);if(source.scope.mode==='complete'&&source.scope.completeForParentIds.includes(r.parentRecordId)&&pin?.revisionId===r.revisionId&&pin.parentRecordId===r.parentRecordId)candidates.push({recordId:r.recordId,expectedRevision:r.revisionId,reason:'Omitted From a Covered Complete Snapshot'});
 }
 for(const request of source.content.archivalRequests){const r=heads.get(request.recordId);if(r?.revisionId===request.expectedRevision&&!candidates.some(c=>c.recordId===r.recordId))candidates.push(request);}
 ensure(archive.every(id=>candidates.some(c=>c.recordId===id)),'CONFLICT','Archival Choice Is Not an Observed, Unchanged Candidate.');
 // Omissions never remove graph members. Selecting a candidate records a proposal,
 // leaving current ROM content intact until implementation is confirmed.
 for(const r of [...heads.values()]){const fields=r.kind==='map'?['subzoneIds']:r.kind==='subzone'?['appearanceIds','sceneIds','interactiveIds']:[];const current=structuredClone(r.current);let changed=false;
  for(const field of fields){const kind={subzoneIds:'subzone',appearanceIds:'appearance',sceneIds:'scene',interactiveIds:'interactive'}[field];for(const child of heads.values())if(child.kind===kind&&child.parentRecordId===r.recordId&&!current.payload[field].includes(child.recordId)){current.payload[field].push(child.recordId);changed=true;}}
  if(changed){const next=revision(r,[r.revisionId],current,operation+':membership-'+sha(r.recordId).slice(0,16));revisions.push(next);heads.set(r.recordId,next);}
 }
 for(const key of ['plans','reviews','views']){
  const identity={plans:'planId',reviews:'reviewId',views:'viewId'}[key],combined=union(here[key],remote[key]),ids=[...new Set(combined.map(a=>a[identity]))];
  for(const id of ids){const branches=viewHeads(combined.filter(a=>a[identity]===id));if(branches.length<2)continue;const lh=viewHeads(here[key].filter(a=>a[identity]===id)),rh=viewHeads(remote[key].filter(a=>a[identity]===id));
   ensure(lh.length===1&&rh.length===1,'REVIEW_REQUIRED','An Imported Proposal Already Contains Unresolved Branches.');
   const selected=choose(key+':'+id,lh[0],rh[0],'Concurrent '+key+' Versions'),next={...selected,operationId:operation+':'+key+'-'+sha(id).slice(0,16),actorClaim:'content:local-owner',parents:branches.map(a=>a.digest).sort()};if(key==='plans')next.version=Math.max(...combined.filter(a=>a.planId===id).map(a=>a.version))+1;combined.push(seal(next));
  }doc.content[key]=combined;
 }
 const validChoices=new Set(conflicts.map(c=>c.id));ensure(Object.keys(choices).every(k=>validChoices.has(k)),'INVALID','Import Choice Is Not an Observed Conflict.');
 doc.content.records=union(revisions,[...heads.values()]);doc.content.recordHeads=[...heads.values()].map(ref);doc.content.mappings=union(here.mappings,remote.mappings);
 doc.content.archivalRequests=union(doc.content.archivalRequests,candidates.filter(c=>archive.includes(c.recordId)),c=>c.recordId+':'+c.expectedRevision);
 for(const request of candidates.filter(c=>archive.includes(c.recordId))){const r=heads.get(request.recordId),planId='content:rdx-archive-'+sha(r.recordId+':'+r.revisionId).slice(0,32);if(doc.content.plans.some(p=>p.planId===planId))continue;doc.content.plans.push(seal({schema:'NPCDexPlanRevision/1',workspaceId:doc.datasetId,operationId:operation+':archive-'+sha(r.recordId).slice(0,16),createdAt:source.createdAt,actorClaim:'content:local-owner',planId,parents:[],version:1,target:{recordId:r.recordId,pointId:null,blockIds:[],promptKey:null,gender:null},baseline:ref(r),intent:'REMOVE',workflow:'draft',instructions:request.reason,proposedDialogue:'',readSet:[ref(r)],changes:[{recordId:r.recordId,path:'/lifecycle',before:{exists:true,value:r.current.lifecycle},after:{exists:true,value:'archived'}}],requiredAssetIds:[],reviewRefs:[],legacyRefs:[]}));}
 doc.scope.ownedRecordIds=[...heads.values()].filter(r=>!['region','shared','profile'].includes(r.kind)).map(r=>r.recordId);doc.scope.contextRecordIds=[...heads.values()].filter(r=>['region','shared','profile'].includes(r.kind)).map(r=>r.recordId);
 doc.scope.mode='partial';doc.scope.completeForParentIds=[];doc.scope.baselineInventory=[];doc.parents=[...new Set([...doc.parents,source.revision])];doc.revision=documentRevision(doc);
 const preview={token,baseline,sourceRevision:source.revision,mode:'update',items,conflicts,candidates,requiresHumanTesting:true,unbound:true};
 // Invalid cross-record combinations remain blocked and cannot be confirmed.
 if(conflicts.every(c=>c.choice))validateDocument(Buffer.from(canonical(doc)),{blobs});
 return {document:doc,blobs,preview};
}
