// Pure plan merge extracted from the accepted desktop importer. No native publication or filesystem code.
import {canonical,sha,same} from '../content/contracts.mjs';
import {retainDocument} from './map-import.mjs';
import {documentRevision} from './document.mjs';
import {ensure} from './limits.mjs';
const documentKey=d=>d.datasetId+':'+d.documentId;
export const taskRevision=t=>{const v={...t};delete v.baseRevision;return sha(canonical(v));};
const digest=v=>sha(canonical(v));
const union=(a,b,key)=>[...new Map([...a,...b].map(v=>[key(v),v])).values()];
export function previewPlanImport(incoming,local=null,choices={}){
 const source=incoming.document;ensure(source.kind==='plan','WORKSPACE','This Is an NPCDex Map. Use Import RDX Map.');ensure(source.origin.role!=='agent-result','REVIEW_REQUIRED','Agent Results Require Task Reconciliation.');
 const doc=structuredClone(local?.document||source),blobs=new Map([...(local?.blobs||[]),...incoming.blobs]),conflicts=[],items=[];
 const choose=(id,a,b,reason)=>{const choice=choices[id];ensure(choice===undefined||['local','incoming'].includes(choice),'INVALID','Invalid Plan Import Choice.');conflicts.push({id,local:a,incoming:b,reason,choice:choice||null});return choice==='incoming'?b:a;};
 if(local){ensure(documentKey(source)===documentKey(doc),'CONFLICT','Plan Document Identity Differs.');
  const tasks=new Map(doc.content.tasks.map(t=>[t.taskId,t]));
  for(const task of source.content.tasks){const prior=tasks.get(task.taskId);let next=task,action='Add';if(prior){if(taskRevision(prior)===taskRevision(task)){next=prior;action='Unchanged';}else if(task.baseRevision===taskRevision(prior)){action='Update From Pinned Base';}else{next=choose(task.taskId,prior,task,'Different Task Values Without an Exact Current Base');action='Review Task';}
    next=structuredClone(next);for(const key of ['comments','attachments','fields']){const identity={comments:'commentId',attachments:'attachmentId',fields:'key'}[key],values=new Map(prior[key].map(v=>[v[identity],v]));for(const value of next[key])values.set(value[identity],value);next[key]=[...values.values()];}
   }tasks.set(task.taskId,next);items.push({id:task.taskId,title:task.title,action});}
  for(const task of doc.content.tasks)if(!source.content.tasks.some(t=>t.taskId===task.taskId))items.push({id:task.taskId,title:task.title,action:'Retain Omitted Task'});
  doc.content.tasks=[...tasks.values()];doc.content.roots=doc.content.tasks.filter(t=>t.parentTaskId===null).map(t=>t.taskId);
  for(const asset of source.assetInventory){const prior=doc.assetInventory.find(a=>a.assetId===asset.assetId);ensure(!prior||same(prior,asset),'CONFLICT','An Existing Asset ID Has Different Bytes.');if(!prior)doc.assetInventory.push(asset);}
  doc.content.history=union(doc.content.history,source.content.history,h=>h.sha256);retainDocument(doc,blobs,incoming);doc.content.deletionRequests=union(doc.content.deletionRequests,source.content.deletionRequests,r=>r.taskId);
  for(const [id,value]of Object.entries(source.extensions)){if(!Object.hasOwn(doc.extensions,id))doc.extensions[id]=value;else if(!same(doc.extensions[id],value))doc.extensions[id]=choose('extension:'+id,doc.extensions[id],value,'Different Optional Extension Values');}
  for(const key of ['required','optional'])doc.capabilities[key]=[...new Set([...doc.capabilities[key],...source.capabilities[key]])];doc.parents=[...new Set([...doc.parents,source.revision])];doc.revision=documentRevision(doc);
 }else for(const task of source.content.tasks)items.push({id:task.taskId,title:task.title,action:'Add'});
 ensure(Object.keys(choices).every(id=>conflicts.some(c=>c.id===id)),'INVALID','Unknown Plan Import Choice.');
 return {document:doc,blobs,preview:{mode:local?'update':'new',sourceRevision:source.revision,baseline:local?.document.revision||null,items,conflicts,token:digest({source:source.revision,baseline:local?.document.revision||null,choices})}};
}
export function orderedTasks(document){const byId=new Map(document.content.tasks.map(t=>[t.taskId,t])),children=new Map(),out=[],done=new Set();for(const t of document.content.tasks){if(!children.has(t.parentTaskId))children.set(t.parentTaskId,[]);children.get(t.parentTaskId).push(t);}const stack=[...document.content.roots].reverse().map(id=>({task:byId.get(id),depth:0}));while(stack.length){const {task,depth}=stack.pop();ensure(task&&!done.has(task.taskId),'INVALID','Invalid Plan Hierarchy.');ensure(depth<128,'LIMIT','Task Hierarchies Deeper Than 128 Levels Cannot Be Published.');done.add(task.taskId);out.push(task);for(const child of [...children.get(task.taskId)||[]].reverse())stack.push({task:child,depth:depth+1});}ensure(done.size===byId.size,'INVALID','Unreachable Plan Tasks.');return out;}
