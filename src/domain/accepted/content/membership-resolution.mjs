import {same} from './contracts.mjs';
// A reviewed structural join may retain append-only children from every branch.
// Other current values must agree, or come from an explicitly selected branch.
export function membershipResolution(versions,revisions,selected=null){
 const heads=[...new Map(versions.map(r=>[r.revisionId,r])).values()];if(heads.length<2||!['map','subzone'].includes(heads[0].kind))return null;
 const fields=heads[0].kind==='map'?['subzoneIds']:['appearanceIds','sceneIds','interactiveIds'],immutable=r=>Object.fromEntries(['recordId','kind','parentRecordId','mappingRefs','legacyRefs','legacyData'].map(k=>[k,r[k]]));if(!heads.every(r=>same(immutable(r),immutable(heads[0]))))return null;
 const byHash=new Map(revisions.map(r=>[r.revisionId,r])),ancestors=heads.map(r=>{const found=new Map(),todo=[[r.revisionId,0]];while(todo.length&&found.size<=50000){const [hash,distance]=todo.shift();if(found.has(hash))continue;const value=byHash.get(hash);if(!value||value.recordId!==r.recordId)return null;found.set(hash,distance);todo.push(...value.parents.map(h=>[h,distance+1]));}return todo.length?null:found;});if(ancestors.some(a=>!a))return null;
 const common=[...ancestors[0].keys()].filter(hash=>ancestors.every(a=>a.has(hash))).sort((a,b)=>ancestors.reduce((n,x)=>n+x.get(a)-x.get(b),0));if(!common.length)return null;const baseline=byHash.get(common[0]),plain=r=>{const current=structuredClone(r.current);for(const field of fields)current.payload[field]=[];return current;},chosen=selected?heads.find(r=>r.revisionId===selected):heads[0];if(!chosen||!selected&&!heads.every(r=>same(plain(r),plain(chosen))))return null;
 const current=structuredClone(chosen.current);for(const field of fields){const old=baseline.current.payload[field];if(!Array.isArray(old)||heads.some(r=>!Array.isArray(r.current.payload[field])||!same(r.current.payload[field].slice(0,old.length),old)))return null;current.payload[field]=[...new Set([...old,...[...heads].sort((a,b)=>a.revisionId.localeCompare(b.revisionId)).flatMap(r=>r.current.payload[field].slice(old.length))])];}
 return {template:chosen,current,parents:heads.map(r=>r.revisionId).sort()};
}
