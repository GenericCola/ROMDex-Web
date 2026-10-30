// Accepted desktop plan importer, 28c0ce4. Only browser import paths and Buffer adapted.
import {canonical,sha,same} from '../content/contracts.mjs';
import {indexTree,materialize,STATES} from '../core.mjs';
import {validateCustomValue} from '../custom-editor.mjs';
import {dateTimestamp} from '../item-editor.mjs';
import {validateFile} from '../attachment-core.mjs';
import {documentRevision} from './document.mjs';
import {Buffer} from 'buffer/index.js';
const documentKey=d=>d.datasetId+':'+d.documentId;
import {retainDocument} from './map-import.mjs';
import {ensure} from './limits.mjs';
export const TIERS=['epic','saga','story','verse','task'];
export const taskRevision=t=>{const v={...t};delete v.baseRevision;return sha(canonical(v));};
const digest=v=>sha(canonical(v));
const own=(object,key)=>object&&Object.hasOwn(object,key)?object[key]:undefined;
const clean=v=>JSON.parse(JSON.stringify(v));
// Native field metadata may contain finite decimal values unrelated to an RDX
// field. Pin their exact JSON representation without changing RDX canonicalization.
const nativeDigest=value=>{const sorted=v=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sorted(v[k])])):v;return sha(JSON.stringify(sorted(clean(value))));};
const union=(a,b,key)=>[...new Map([...a,...b].map(v=>[key(v),v])).values()];
const statuses={'untouched':STATES.grey,'in-progress':STATES.yellow,standby:STATES.blue,'in-development':STATES.purple,complete:STATES.green,critical:STATES.red};
const priorities={low:'Minor',normal:'Normal',high:'Major',urgent:'Critical'};

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
export const publicationState=state=>({items:clean(materialize(state.remote,state.operations)),imports:state.rdxImports||{},operations:clean(state.operations),order:state.order||{},blocked:clean(state.blocked||null)});

export function fieldTargets(options){return [
 {key:'assignee',name:'Assignee',type:'user',ready:options?.assignee?.ready,options:options?.assignee?.options||[],canBeEmpty:options?.assignee?.canBeEmpty},
 {key:'dueDate',name:'Due Date',type:'date',ready:options?.dueDate?.ready,options:[],canBeEmpty:options?.dueDate?.canBeEmpty},
 {key:'tags',name:'Tags',type:'multi-enum',ready:options?.tags?.ready,options:options?.tags?.options||[],canBeEmpty:true},
 ...(options?.custom||[]).map(d=>({...d,ready:!d.readOnly,type:d.multi?'multi-enum':d.choices?(d.type==='user'?'user':'enum'):d.type}))];}
function mappedField(field,mapping,options){
 if(field.readOnly)return {context:true};const key=mapping?.target||({assignee:'assignee','due-date':'dueDate'}[field.key]),def=fieldTargets(options).find(d=>d.key===key);
 ensure(def?.ready&&!def.readOnly,'MAPPING','Map an Editable Destination for '+field.key+'.');ensure(field.type===def.type||field.type==='string'&&def.type==='text','MAPPING','Field Type Differs for '+field.key+'.');let value=field.value;
 if(['user','enum','multi-enum'].includes(field.type)&&value!==null){const convert=v=>{const original=field.type==='user'?v.login:v.optionKey,id=mapping?.values?.[original];ensure(typeof id==='string'&&def.options.some(o=>o.id===id),'MAPPING','Choose a Destination Value for '+field.key+' → '+original+'.');return id;};value=field.type==='multi-enum'?value.map(convert).sort():convert(value);}
 if(value===null)ensure(def.canBeEmpty===true,'MAPPING',field.key+' Cannot Be Empty.');
 if(field.type==='period'&&value!==null)value=value.minutes;
 if(key==='tags'&&value===null)value=[];
 if(key==='dueDate')dateTimestamp(value);else if(key.startsWith('custom:'))validateCustomValue(options.custom.find(d=>d.key===key),value);
 return {key,value};
}
function importedComment(comment){return comment.body+'\n\n---\nImported RDX Context · Original Author: '+comment.authorClaim+' · Original Date: '+comment.createdAt+'\nOriginal Comment ID: '+comment.commentId;}

// Builds only a reviewed local queue batch. There is no network access here.
export function previewPlanPublication(value,{state,connection,options,destination=null,mappings={},choices={},deletions=[],matches={}}={}){
 const doc=value.document,key=documentKey(doc),tasks=orderedTasks(doc),items=materialize(state.remote,state.operations),tree=indexTree(items,state.order),ledger=state.rdxImports?.[key]||{tasks:{},batches:{}},blockers=[],conflicts=[],rows=[],operations=[],uploads=[],nextBindings=structuredClone(ledger.tasks),requestIds=new Set(doc.content.deletionRequests.map(r=>r.taskId));
 ensure(doc.kind==='plan','WORKSPACE','Use the Task Plan Importer.');ensure(tasks.length<=1000,'LIMIT','Publish No More Than 1,000 Tasks per Reviewed Plan.');
 if(destination!==null&&!/^PMON-\d+$/.test(destination))blockers.push('Choose an Existing PMON Destination or Project Root.');if(destination&&!tree.byId.has(destination))blockers.push('The Destination No Longer Exists.');
 if(!connection||connection.project!=='PMON')blockers.push('Connect to PMON Before Queuing This Plan.');if(state.blocked)blockers.push('Resolve the Current Save Queue Review Before Importing More Tasks.');
 const bindingId=t=>own(nextBindings,t.taskId)?.issueId||own(matches,t.taskId)||'local-rdx-'+digest({key,task:t.taskId}),byId=new Map(tasks.map(t=>[t.taskId,t])),depths=new Map();
 const stage=digest({key,revision:doc.revision,destination,mappings,choices,deletions,matches});let opIndex=0;
 const op=(type,data)=>{const operation={opId:'rdx-'+digest({stage,index:opIndex++}),type,...data};operations.push(operation);return operation;};
 const resolve=(id,field,base,incoming,remote)=>{if(same(remote,incoming))return remote;if(same(remote,base))return incoming;if(same(incoming,base))return remote;const name=id+':'+field,choice=choices[name];ensure(choice===undefined||['local','incoming'].includes(choice),'INVALID','Invalid Destination Conflict Choice.');conflicts.push({id:name,taskId:id,field,local:remote,incoming,base,choice:choice||null});return choice==='incoming'?incoming:remote;};
 for(const task of tasks){
  const existing=own(ledger.tasks,task.taskId),binding=existing|| (own(matches,task.taskId)?{issueId:own(matches,task.taskId),desired:{},comments:{},attachments:{},matching:true}:null),issueId=bindingId(task),current=tree.byId.get(issueId),parentId=task.parentTaskId?bindingId(byId.get(task.parentTaskId)):destination,depth=task.parentTaskId?depths.get(task.parentTaskId)+1:destination?(tree.depths.get(destination)??0)+1:0;depths.set(task.taskId,depth);const effectiveTier=TIERS[Math.min(4,depth)];
  if(depth>127)blockers.push('The Destination Would Exceed the 128-Level Hierarchy Limit.');
  rows.push({taskId:task.taskId,title:task.title,description:task.description,status:task.status,priority:task.priority,complexity:task.complexity,issueId,parentId,parentTitle:task.parentTaskId?byId.get(task.parentTaskId)?.title:destination?tree.byId.get(destination)?.summary:'Project Root',declaredTier:task.declaredTier,effectiveTier,bound:!!existing,matching:binding?.matching===true,action:requestIds.has(task.taskId)?'Deletion Requested':binding?.matching?'Match Existing Task':binding?'Update Existing Task':'Create',fields:task.fields,comments:task.comments.length,attachments:task.attachments.length});
  if(existing&&own(matches,task.taskId)&&existing.issueId!==own(matches,task.taskId))blockers.push('An Existing Task Binding Cannot Be Reassigned.');if(binding?.matching&&Object.entries(state.rdxImports||{}).some(([other,l])=>other!==key&&Object.values(l.tasks).some(b=>b.issueId===issueId)))blockers.push('This Native Task Is Already Bound to Another Managed Plan.');
  if(binding?.deleted){if(!requestIds.has(task.taskId))blockers.push(task.title+' Was Deleted Through This Binding. Use a New Task Identity to Recreate It.');continue;}
  if(binding&&!current){blockers.push('The Bound Task Is Missing: '+issueId);continue;}
  if(binding&&Object.values(ledger.batches).some(b=>!['complete','cancelled'].includes(b.status)&&b.taskIds.includes(task.taskId))){blockers.push('A Previous Plan Batch Still Needs Completion or Review: '+task.title);continue;}
  if(requestIds.has(task.taskId))continue;
  const desired={summary:task.title.trim(),description:task.description,assignedState:statuses[task.status],priority:priorities[task.priority],complexity:task.complexity?.toUpperCase()||null,parentId};if(!desired.summary)blockers.push('Enter a Nonblank Task Title.');
  if(!connection?.complexity?.ready&&desired.complexity===null&&!binding?.desired.complexity)delete desired.complexity;
  if(connection?.missingStates?.includes(desired.assignedState))blockers.push('Set Up the Required Status: '+desired.assignedState);if(connection?.priorities&&!connection.priorities.includes(desired.priority))blockers.push('Priority Is Unavailable: '+desired.priority);if(desired.complexity&&!connection?.complexity?.ready)blockers.push('Set Up Complexity Before Publishing a Complexity Value.');
  const keys=new Set(Object.keys(desired));for(const field of task.fields)try{const mapped=mappedField(field,mappings[field.key],options);if(mapped.context)continue;ensure(!keys.has(mapped.key),'MAPPING','Two Portable Fields Target '+mapped.key+'.');keys.add(mapped.key);desired[mapped.key]=mapped.value;}catch(e){blockers.push(task.title+' · '+e.message);}
  const saved=nextBindings[task.taskId]={...binding,issueId,sourceTaskDigest:taskRevision(task),portable:structuredClone(task),fieldMappings:structuredClone(mappings),baseRevision:task.baseRevision,desired:structuredClone(desired),matching:false,comments:{...binding?.comments},attachments:{...binding?.attachments}};
  if(!binding)op('create',{issueId,item:{...desired,id:issueId,state:desired.assignedState,type:'Task',updated:null,comments:[],commentCount:0,dependencies:0,fields:{}}});
  else {const patch={};for(const [field,wanted]of Object.entries(desired)){let target=wanted;if(binding.matching&&!same(wanted,current[field]??null)){const id=task.taskId+':'+field,choice=choices[id];ensure(choice===undefined||['local','incoming'].includes(choice),'INVALID','Invalid Match Review Choice.');conflicts.push({id,taskId:task.taskId,field,local:current[field]??null,incoming:wanted,base:null,choice:choice||null});target=choice==='incoming'?wanted:current[field];}else if(field==='priority'&&current.priority==='Show-stopper'&&binding.desired.priority===wanted)target=current.priority;else target=resolve(task.taskId,field,binding.desired[field]??null,wanted,current[field]??null);if(!same(target??null,current[field]??null))patch[field]=target;}if(Object.keys(patch).length)op('edit',{issueId,base:structuredClone(current),patch});}
  for(const comment of task.comments){const fingerprint=digest(comment);if(binding?.matching&&(current.comments||[]).some(c=>c.text===importedComment(comment)||c.text===comment.body&&(typeof c.author==='string'?c.author:c.author?.login||c.author?.name)===comment.authorClaim&&Number.isFinite(c.created)&&new Date(c.created).toISOString()===comment.createdAt))binding.comments[comment.commentId]=fingerprint;const prior=own(binding?.comments,comment.commentId);if(prior){saved.comments[comment.commentId]=prior;if(prior!==fingerprint)blockers.push('An Imported Comment ID Has Different Content. Use a New Comment ID: '+comment.commentId);continue;}if(!comment.body.trim()){blockers.push('Imported Comments Cannot Be Blank.');continue;}op('comment',{issueId,text:importedComment(comment)});saved.comments[comment.commentId]=fingerprint;}
  for(const attachment of task.attachments){const asset=doc.assetInventory.find(a=>a.assetId===attachment.assetId),file={name:attachment.name,size:asset.bytes,mimeType:asset.mime,hash:asset.sha256},fingerprint=digest({attachment,file}),prior=own(binding?.attachments,attachment.attachmentId);try{validateFile(file);}catch(e){blockers.push(task.title+' · '+e.message);continue;}if(prior){if(prior!==fingerprint)blockers.push('An Imported Attachment ID Has Different Content. Use a New Attachment ID: '+attachment.attachmentId);continue;}if(binding?.matching&&(current.attachments||[]).some(f=>f.name===file.name&&f.size===file.size&&f.hash===file.hash)){saved.attachments[attachment.attachmentId]=fingerprint;continue;}const entry=op('attachment',{issueId,uploadId:null,file});entry.uploadId=entry.opId;uploads.push({uploadId:entry.uploadId,sha256:asset.sha256,file});saved.attachments[attachment.attachmentId]=fingerprint;}
 }
 const deleteIds=[];for(const taskId of deletions){const request=doc.content.deletionRequests.find(r=>r.taskId===taskId),binding=own(ledger.tasks,taskId),item=binding&&tree.byId.get(binding.issueId);
  if(binding?.deleted)continue;if(!request||!binding||!item||request.expectedRevision!==binding.sourceTaskDigest){blockers.push('The Deletion Has No Matching Imported Task Baseline: '+taskId);continue;}if(binding.nativeUpdated!==item.updated){const choice=choices[taskId+':delete'];ensure(choice===undefined||['local','incoming'].includes(choice),'INVALID','Invalid Deletion Review Choice.');conflicts.push({id:taskId+':delete',taskId,field:'Delete Updated Task',local:item,incoming:'Delete',base:binding.nativeUpdated??null,choice:choice||null});if(choice!=='incoming')continue;}deleteIds.push(item.id);nextBindings[taskId]={...binding,deleted:true};}
 for(const request of doc.content.deletionRequests)if(!deletions.includes(request.taskId))rows.push({taskId:request.taskId,title:byId.get(request.taskId)?.title,action:'Keep Pending Deletion',reason:request.reason});
 if(deleteIds.length){for(const item of items)if(item.parentId&&deleteIds.includes(item.parentId)&&!deleteIds.includes(item.id))blockers.push('Deletion Would Affect an Unreviewed Child: '+item.id);op('delete',{ids:deleteIds,bases:Object.fromEntries(deleteIds.map(id=>[id,tree.byId.get(id)]))});}
 ensure(Object.entries(matches).every(([task,id])=>byId.has(task)&&/^PMON-\d+$/.test(id))&&new Set(Object.values(matches)).size===Object.keys(matches).length,'INVALID','Choose Unique Existing PMON Tasks for Matching.');
 ensure(deletions.every(id=>requestIds.has(id)),'INVALID','Unknown Plan Deletion Choice.');ensure(Object.keys(choices).every(id=>conflicts.some(c=>c.id===id)),'INVALID','Unknown Destination Conflict Choice.');
 try{const placed=indexTree(materialize(items,operations),state.order);for(const r of rows.filter(r=>r.issueId)){const item=placed.byId.get(r.issueId);if(item){r.parentId=item.parentId;r.parentTitle=placed.byId.get(item.parentId)?.summary||'Project Root';r.effectiveTier=TIERS[Math.min(4,placed.depths.get(item.id)||0)];}}}catch(e){blockers.push(e.message);}if(Buffer.byteLength(JSON.stringify(operations))>12*1024*1024)blockers.push('This Plan Exceeds the 12 MiB Publication Queue Limit. Split It Into Smaller Plans.');
 const token=nativeDigest({key,revision:doc.revision,state:publicationState(state),connection:clean(connection||null),options:clean(options||null),destination,mappings,choices,deletions,matches});
 const insertions=new Map(),order={};for(const o of operations){const parent=o.type==='create'?o.item.parentId:o.type==='edit'&&Object.hasOwn(o.patch,'parentId')?o.patch.parentId:undefined;if(parent===undefined)continue;if(!insertions.has(parent))insertions.set(parent,[]);insertions.get(parent).push(o.issueId);}for(const [parent,ids]of insertions){const siblings=(tree.children.get(parent)||[]).map(i=>i.id).filter(id=>!ids.includes(id));[...siblings,...ids].forEach((id,index)=>order[id]=index);}
 return {preview:{key,revision:doc.revision,token,destination,rows,conflicts,blockers:[...new Set(blockers)],operationCount:operations.length,deletions:doc.content.deletionRequests,ready:!blockers.length&&conflicts.every(c=>c.choice)},batch:{key,batchId:'rdx-batch-'+stage,revision:doc.revision,destination,taskIds:tasks.map(t=>t.taskId),operations,uploads,bindings:nextBindings,order}};
}
