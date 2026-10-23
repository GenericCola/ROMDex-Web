import {requireThat,validateGraph,sha} from './contracts.mjs';

import {hasNativeViews,projectNativeNPCDex} from './native-projection.mjs';
export const PROJECTION_VERSION='NPCDexContentProjection/3';
const heads=(values,identity)=>{const parents=new Set(values.flatMap(x=>x.parents||[]));const visible=values.filter(x=>!parents.has(x.digest));const groups=new Map();for(const a of visible){const id=a[identity];if(!groups.has(id))groups.set(id,[]);groups.get(id).push(a);}return [...groups.values()].flat();};

// Explicit adapter to NPCDex v2 presentation. No embedded baseline or YouTrack task State.
export function projectNPCDex(domain,{revision=1,assetBytes=()=>null,gender='male'}={}){
 requireThat(['male','female'].includes(gender),'Invalid Preview Player Gender.');const records=validateGraph(domain.records);
 if(hasNativeViews(domain))return projectNativeNPCDex(domain,{revision,gender,assetBytes});
 if(domain.records.some(r=>r.kind==='shared'&&r.current.payload.definitions?.migration?.format==='ROMDexLegacyMigration/1'))throw Error('Use the verified desktop migration flow for legacy original-save maps. This file remains available for export.');
 const image=id=>{if(!id)return null;const ref=domain.assets.find(a=>a.assetId===id);requireThat(ref&&/^image\/(png|jpeg|gif|webp)$/.test(ref.mime),'Unsupported Tile Image.');const bytes=assetBytes(ref.sha256);requireThat(bytes&&bytes.length===ref.bytes&&sha(bytes)===ref.sha256,'Tile Image Is Not in the Verified Cache.');return {dataUrl:'data:'+ref.mime+';base64,'+bytes.toString('base64'),name:id};};
 const speaker=(record,point,profile)=>{if(!profile)return null;const ids=record.kind==='appearance'?[record.recordId,...point.participantIds]:[...point.participantIds,...(record.current.payload.participantIds||[])];const matches=[...new Set(ids)].map(id=>records.get(id)).filter(r=>r?.kind==='appearance'&&(r.current.payload.profileByPlayerGender[gender]||r.current.payload.profileId)===profile);return matches.length===1?matches[0].recordId:'unresolved:'+profile;};
 const convertPoints=record=>record.current.payload.pointOrder.map(id=>{
  const p=record.current.payload.points[id];return {id:p.id,condition:p.condition,stages:[...p.stageIds],ids:[...p.sourceIds],participants:[...p.participantIds],evidence:structuredClone(p.evidence),blocks:p.blockOrder.map(key=>{const b=p.blocks[key];return {id:b.id,type:b.kind,text:b.text,speaker:speaker(record,p,b.speaker),speakerProfileId:b.speaker,gender:b.gender,reviewKey:b.reviewKey,archived:b.archived,sourceBlockId:b.sourceBlockId,sourceIds:[...b.sourceIds],rawMessageData:structuredClone(b.rawMessageData),legacyData:structuredClone(b.legacyData)};}),legacyData:structuredClone(p.legacyData)};
 });
 const towns=[];
 for(const map of domain.records.filter(r=>r.kind==='map')){
  const p=map.current.payload,town={id:map.recordId,name:p.name,subtitle:records.get(p.regionId).current.payload.name,areas:[],locations:[],characters:[],archived:map.current.lifecycle==='archived',contentRecordId:map.recordId};
  for(const id of p.subzoneIds){const zone=records.get(id),z=zone.current.payload,area={id:zone.recordId,name:z.name,elements:[],archived:zone.current.lifecycle==='archived',contentRecordId:zone.recordId};town.areas.push(area);town.locations.push({id:zone.recordId,name:z.name,areaIds:[zone.recordId],archived:area.archived});
   for(const rid of [...z.appearanceIds,...z.sceneIds,...z.interactiveIds]){const record=records.get(rid),payload=record.current.payload,planned=record.current.lifecycle==='planned';
    const profile=record.kind==='appearance'?records.get(payload.profileByPlayerGender[gender]||payload.profileId):null;
    const name=payload.overrides?.displayName||profile?.current.payload.name||payload.name;
    const element={id:rid,name:name+(planned?' (Planned Addition)':''),type:record.kind==='appearance'?'npc':record.kind==='scene'?'scene':'interactive',kind:record.kind,gender:'both',participants:[...(payload.participantIds||[])],points:convertPoints(record),archived:record.current.lifecycle==='archived',contentRecordId:rid,legacyRefs:structuredClone(record.legacyRefs),legacyData:structuredClone(record.legacyData)};
    area.elements.push(element);
    if(profile)town.characters.push({id:rid,name:element.name,gender:'both',elementIds:[rid],sceneIds:[...payload.sceneIds],image:image(payload.overrides.imageAssetId||profile.current.payload.baseImageId),archived:element.archived,profileId:profile.recordId,contentRecordId:rid});
   }
  }
  towns.push(town);
 }
 requireThat(towns.length>0,'No Map Content Is Available for NPCDex.');
 const progression=domain.records.find(r=>r.kind==='shared'&&r.current.payload.sharedType==='progression');const definitions=progression?.current.payload.definitions;
 const stages=Array.from({length:10},(_,i)=>({id:String.fromCharCode(65+i),name:'Stage '+String.fromCharCode(65+i),event:'Timeline Definition Not Yet Supplied'}));
 if(definitions?.stages){requireThat(Array.isArray(definitions.stages)&&definitions.stages.length===10,'Unsupported Timeline Projection.');for(let i=0;i<10;i++){const s=definitions.stages[i];requireThat(s.id===stages[i].id&&typeof s.name==='string'&&typeof s.event==='string','Invalid Timeline Stage.');stages[i]={...s};}}
 const reviews=heads(domain.reviews,'reviewId'),reviewStates=reviews.map(r=>({digest:r.digest,status:records.get(r.target.recordId).revisionId===r.baseline.revisionId?r.testStatus:'unreviewed',stale:records.get(r.target.recordId).revisionId!==r.baseline.revisionId}));
 return {version:2,revision,savedAt:null,contentRevision:0,towns,stages,annotations:{},characterImages:{},characterNames:{},preferences:{gender,sortBySubArea:false},changePlans:{},history:[],implementationReceipts:[],liveMappings:{},romReversalResolutions:[],legacyChangePlans:{},decisionConflicts:[],promptStatusUnset:{},sourceBaselines:{},reconciliations:[],sources:[],index:{},contentPreview:{readOnly:true,records:domain.records.map(r=>({id:r.recordId,kind:r.kind,lifecycle:r.current.lifecycle,revisionId:r.revisionId,legacyRefs:r.legacyRefs,legacyData:r.legacyData})),plans:heads(domain.plans,'planId'),reviews,reviewStates,mappingCount:domain.mappings.length}};
}
