import {requireThat,verifyDigest,validateGraph,same,unique,pointPayload} from './contracts.mjs';
import {validateViews} from './view-contract.mjs';
import {applyCatalog} from './catalog-core.mjs';
import {membershipResolution} from './membership-resolution.mjs';
const digest=a=>a.revisionId||a.digest;
const empty=()=>({records:[],plans:[],reviews:[],mappings:[],assets:[],revisions:[]});
export const versionHeads=(list,identity,id)=>{const values=list.filter(a=>a[identity]===id),parents=new Set(values.flatMap(a=>a.parents));return values.filter(a=>!parents.has(a.digest));};
function stableRecord(before,after){requireThat(after.kind===before.kind&&after.parentRecordId===before.parentRecordId&&same(after.mappingRefs,before.mappingRefs)&&same(after.legacyRefs,before.legacyRefs)&&same(after.legacyData,before.legacyData),'Editing Cannot Rebind, Remap or Discard Compatibility Data.');requireThat(same(after.parents,[before.revisionId]),'Record Parent Revision Differs.');}
function appendVersion(domain,a,key,identity){
 const prior=domain[key].filter(x=>x[identity]===a[identity]);const heads=versionHeads(prior,identity,a[identity]);
 requireThat(same([...a.parents].sort(),heads.map(h=>h.digest).sort()),'Editing Must Cover Every Current Proposal Head.');
 if(prior.length)requireThat(same(a.target,prior[0].target),'A Proposal Cannot Move to Another Target.');
 if(key==='plans'){requireThat(a.version===1+Math.max(0,...prior.map(x=>x.version)),'Plan Version Does Not Advance.');requireThat(a.workflow!=='implemented','Planning Cannot Claim Implementation.');if(a.workflow==='ready')requireThat(a.intent!=='FINAL'&&a.instructions.trim()&&a.changes.some(c=>!same(c.before,c.after)),'Ready Proposals Need Instructions and Scoped Changes.');if(a.intent==='FINAL')requireThat(['draft','final','superseded'].includes(a.workflow),'FINAL Is an Editorial Decision.');}
 domain[key].push(a);
}
export function validateDomain(domain){
 for(const key of ['records','plans','reviews','mappings','assets'])requireThat(domain[key].length<=10000,'Content Domain Collection Exceeds Its Bound.');requireThat(domain.revisions.length<=50000,'Content Revision History Exceeds Its Bound.');
 const graph=validateGraph(domain.records),revisions=new Map(domain.revisions.map(r=>[r.revisionId,r]));
 for(const artifact of [...domain.plans,...domain.reviews]){
  requireThat(graph.has(artifact.target.recordId),'Proposal or Review Target Is Missing.');
  const base=revisions.get(artifact.baseline.revisionId);requireThat(base?.recordId===artifact.target.recordId,'Proposal Baseline Is Missing.');
  for(const ref of artifact.readSet||[])requireThat(revisions.get(ref.revisionId)?.recordId===ref.recordId,'Proposal Read Reference Is Missing.');
  const point=artifact.target.pointId?pointPayload(base)?.points[artifact.target.pointId]:null;
  if(artifact.target.pointId)requireThat(point,'Proposal Point Is Missing.');for(const id of artifact.target.blockIds)requireThat(point?.blocks[id],'Proposal Block Is Missing.');
 }
 for(const [list,key]of [[domain.plans,'planId'],[domain.reviews,'reviewId']]){const byHash=new Map(list.map(a=>[a.digest,a])),marks=new Map();for(const artifact of list){if(marks.get(artifact.digest)===2)continue;const stack=[{artifact,next:0}];while(stack.length){const frame=stack.at(-1),a=frame.artifact;marks.set(a.digest,1);if(frame.next===a.parents.length){marks.set(a.digest,2);stack.pop();continue;}const hash=a.parents[frame.next++],parent=byHash.get(hash);requireThat(parent&&parent[key]===a[key],'Proposal Ancestry Is Missing or Mismatched.');requireThat(marks.get(hash)!==1,'Proposal Ancestry Cycle.');if(marks.get(hash)!==2)stack.push({artifact:parent,next:0});}}}
 const mappings=new Map(domain.mappings.map(m=>[m.digest,m]));
 for(const record of domain.records)for(const ref of record.mappingRefs)requireThat(mappings.get(ref)?.recordId===record.recordId,'Record Mapping Is Missing.');
 const assets=new Set(domain.assets.map(a=>a.assetId));
 for(const record of domain.records){const p=record.current.payload;for(const id of [p.baseImageId,p.overrides?.imageAssetId].filter(Boolean))requireThat(assets.has(id),'Content Image Asset Is Missing.');}
 for(const plan of domain.plans)for(const id of plan.requiredAssetIds)requireThat(assets.has(id),'Plan Asset Is Missing.');
 validateViews(domain);return domain;
}
export function applyPublication(parent,pub,artifacts,assets){
 requireThat(same([...pub.artifactDigests].sort(),artifacts.map(digest).sort()),'Publication Artifact Set Differs.');
 unique(artifacts.map(a=>a.operationId),'Operation Within Publication');
 // Artifacts are immutable. Copy collection containers, not historical bodies.
 const domain=parent?Object.fromEntries(Object.entries(parent).map(([key,value])=>[key,[...value]])):empty();
 const prior=new Map(domain.records.map(r=>[r.recordId,r]));
 for(const base of pub.baseRevisions)requireThat(prior.get(base.recordId)?.revisionId===base.revisionId,'Publication Baseline Is Stale.');
 if(pub.kind==='bootstrap'){
  requireThat(!parent&&!pub.parentPublications.length&&!pub.baseRevisions.length&&!pub.resultDigest&&!pub.groupId,'Invalid Initial Publication.');
  for(const a of artifacts){
   if(a.schema==='NPCDexContentRevision/1'){requireThat(a.parents.length===0,'Bootstrap Record Has a Prior Revision.');domain.records.push(a);domain.revisions.push(a);}
   else if(a.schema==='NPCDexPlanRevision/1')domain.plans.push(a);
   else if(a.schema==='NPCDexReviewRevision/1')domain.reviews.push(a);
   else if(a.schema==='NPCDexROMMapping/1')domain.mappings.push(a);
   else throw Error('Unsupported Bootstrap Artifact.');
  }
 }else if(pub.kind==='catalog'){
  applyCatalog(domain,parent,pub,artifacts);
 }else if(pub.kind==='planning'){
  requireThat(parent&&!pub.resultDigest&&!pub.groupId,'Invalid Planning Publication.');
  const additions=artifacts.filter(a=>a.schema==='NPCDexContentRevision/1'&&!prior.has(a.recordId));
  for(const a of artifacts){
   if(a.schema==='NPCDexPlanRevision/1'||a.schema==='NPCDexReviewRevision/1'){const key=a.schema==='NPCDexPlanRevision/1'?'plans':'reviews';appendVersion(domain,a,key,key==='plans'?'planId':'reviewId');continue;}
   requireThat(a.schema==='NPCDexContentRevision/1','Planning Cannot Replace Current Content.');const before=prior.get(a.recordId);
   if(!before){requireThat(['profile','appearance','scene','interactive'].includes(a.kind)&&a.current.lifecycle==='planned'&&!a.parents.length&&!a.mappingRefs.length&&!a.legacyRefs.length&&!Object.keys(a.legacyData).length,'New Content Must Be a Planned Addition.');domain.records.push(a);}
   else{
    stableRecord(before,a);
    if(before.current.lifecycle==='planned')requireThat(['planned','archived'].includes(a.current.lifecycle),'Planning Cannot Activate ROM Content.');
    else{const expected=structuredClone(before.current);requireThat(before.kind==='subzone','Planning Cannot Replace Current Content.');for(const [field,kind]of [['appearanceIds','appearance'],['sceneIds','scene'],['interactiveIds','interactive']])expected.payload[field].push(...additions.filter(x=>x.kind===kind&&x.parentRecordId===before.recordId).map(x=>x.recordId));requireThat(same(a.current,expected),'Planning Can Only Append Planned Membership to Existing Content.');}
    domain.records=domain.records.map(r=>r.recordId===a.recordId?a:r);
   }domain.revisions.push(a);
  }
 }else if(pub.kind==='correction'){
  requireThat(parent&&pub.resultDigest&&!pub.groupId,'Invalid Documentation Correction Publication.');
  const correction=artifacts.find(a=>a.digest===pub.resultDigest);requireThat(correction?.schema==='NPCDexDocumentationCorrection/1'&&correction.romChangeRequested===false&&correction.reason.trim()&&correction.evidence.length,'Documentation Correction Evidence Is Missing.');
  for(const ref of correction.readSet)requireThat(prior.get(ref.recordId)?.revisionId===ref.revisionId,'Documentation Correction Is Stale.');
  unique(correction.recordUpdates.map(u=>u.before.recordId),'Correction Target');
  requireThat(artifacts.length===correction.recordUpdates.length+1,'Correction Contains Unrelated Artifacts.');
  for(const update of correction.recordUpdates){
   const before=prior.get(update.before.recordId),after=update.after;
   requireThat(before?.revisionId===update.before.revisionId&&after.recordId===before.recordId&&after.kind===before.kind,'Correction Target Differs.');
   stableRecord(before,after);requireThat(before.current.lifecycle!=='planned'||after.current.lifecycle!=='active','A Planned Addition Cannot Be Activated by a Documentation Correction.');
   if(after.current.lifecycle==='active'&&before.current.lifecycle==='archived')requireThat(domain.revisions.some(r=>r.recordId===before.recordId&&r.current.lifecycle==='active'),'An Archived Planned Addition Cannot Be Activated by a Documentation Correction.');
   requireThat(before.current.lifecycle===after.current.lifecycle||['active','archived'].includes(before.current.lifecycle)&&['active','archived'].includes(after.current.lifecycle),'Unsupported Documentation Lifecycle Correction.');
   requireThat(artifacts.some(a=>a.revisionId===after.revisionId&&same(a,after)),'Correction After-Revision Is Missing.');
   domain.records=domain.records.map(r=>r.recordId===before.recordId?after:r);domain.revisions.push(after);
  }
 }else throw Error('This Publication Workflow Is Not Enabled in This Content Phase.');
 for(const asset of assets){const previous=domain.assets.find(a=>a.assetId===asset.assetId);requireThat(!previous||previous.sha256===asset.sha256,'Asset Identity Was Reused for Different Bytes.');if(!previous)domain.assets.push(asset);}
 for(const list of [domain.plans,domain.reviews]){
  unique(list.map(a=>a.digest),'Versioned Proposal');
  for(const a of list){verifyDigest(a);for(const p of a.parents)requireThat(p!==a.digest,'Proposal Revision Cycle.');}
 }
 return validateDomain(domain);
}

// Explicit owner review joins exactly the named branches. Every original version survives.
export function resolvePublication(parents,pub,artifacts,assets){
 requireThat(parents.length>=2&&parents.length<=16&&!pub.resultDigest&&!pub.groupId,'Invalid Reviewed Resolution.');
 requireThat(same([...pub.artifactDigests].sort(),artifacts.map(digest).sort()),'Resolution Artifact Set Differs.');
 const union=(key,id)=>{const values=new Map();for(const parent of parents)for(const value of parent[key]){const prior=values.get(value[id]);requireThat(!prior||same(prior,value),'Conflicting Immutable Identity.');values.set(value[id],value);}return [...values.values()];};
 const domain={records:[],plans:union('plans','digest'),reviews:union('reviews','digest'),mappings:union('mappings','digest'),assets:union('assets','assetId'),revisions:union('revisions','revisionId')};
 if(parents.some(p=>p.views?.length)){const all=new Map();for(const p of parents)for(const v of p.views||[]){const old=all.get(v.digest);requireThat(!old||same(old,v),'Conflicting Immutable Presentation Identity.');all.set(v.digest,v);}domain.views=[...all.values()];}
 const allRecords=new Map();for(const parent of parents)for(const r of parent.records){if(!allRecords.has(r.recordId))allRecords.set(r.recordId,[]);allRecords.get(r.recordId).push(r);}
 requireThat(same(pub.baseRevisions.map(r=>r.recordId+':'+r.revisionId).sort(),[...new Set(parents.flatMap(p=>p.records.map(r=>r.recordId+':'+r.revisionId)))].sort()),'Resolution Must Review Every Branch Baseline.');
 const selected=artifacts.filter(a=>a.schema==='NPCDexContentRevision/1');unique(selected.map(r=>r.recordId),'Resolved Record');requireThat(selected.length===allRecords.size,'Resolution Must Preserve All Records.');
 for(const r of selected){const observed=allRecords.get(r.recordId);if(!observed?.some(x=>same(x,r))){const options=observed?.map(x=>membershipResolution(observed,domain.revisions,x.revisionId)).filter(Boolean)||[];const merge=options.find(m=>same(r.current,m.current)&&same(r.parents,m.parents)&&['kind','parentRecordId','mappingRefs','legacyRefs','legacyData'].every(k=>same(r[k],m.template[k])));requireThat(merge,'Resolution Must Select Observed Values and Preserve Append-Only Membership.');domain.revisions.push(r);}domain.records.push(r);}
 for(const a of artifacts.filter(a=>a.schema!=='NPCDexContentRevision/1')){if(a.schema==='NPCDexViewRevision/1'){const prior=(domain.views||[]).filter(v=>v.viewId===a.viewId);const heads=prior.filter(v=>!prior.some(x=>x.parents.includes(v.digest)));requireThat(heads.length>1&&same([...a.parents].sort(),heads.map(v=>v.digest).sort()),'Presentation Resolution Must Cover Every Observed Version.');const identical=heads.every(v=>same(v.payload,heads[0].payload)),rootMerge=a.viewId==='view:root'&&heads.every(v=>same({...v.payload,collectionOrder:[]},{...heads[0].payload,collectionOrder:[]}))&&same({...a.payload,collectionOrder:[]},{...heads[0].payload,collectionOrder:[]})&&same([...a.payload.collectionOrder].sort(),[...new Set(heads.flatMap(v=>v.payload.collectionOrder))].sort());requireThat((identical&&same(a.payload,heads[0].payload))||rootMerge||heads.some(v=>same(a.payload,v.payload)),'Presentation Resolution Must Select Observed Metadata or Merge Independent Map Ordering.');domain.views.push(a);continue;}requireThat(['NPCDexPlanRevision/1','NPCDexReviewRevision/1'].includes(a.schema),'Unsupported Resolution Artifact.');appendVersion(domain,a,a.schema==='NPCDexPlanRevision/1'?'plans':'reviews',a.schema==='NPCDexPlanRevision/1'?'planId':'reviewId');}
 requireThat(!assets.length,'Resolution Cannot Introduce Unreviewed Assets.');return validateDomain(domain);
}
