import {applyPlanSync} from './plan-queue.mjs';
export const STATUS = {grey:'Untouched',yellow:'In Progress',blue:'Standby',purple:'In Development',green:'Complete',red:'Critical'};
export const STATES = {grey:'To do',yellow:'In Progress',blue:'Standby',purple:'In Development',green:'Done',red:'Critical / Debugging'};
export const FIELDS = ['summary','description','state','priority','complexity','parentId','assignedState','assignee','dueDate','tags'];
export const isEditableField=key=>FIELDS.includes(key)||/^custom:[-\w]{1,100}$/.test(key);
export const clone = x => structuredClone(x);
export const planNeedsReview=state=>Object.values(state?.rdxImports||{}).some(ledger=>!!ledger.review||Object.values(ledger.batches||{}).some(b=>['blocked','needs-review'].includes(b.status)));
export function saveNeedsAttention(state, connection, dirtyFields = {}) {
  const pending = !!(planNeedsReview(state)||state?.operations?.length || state?.blocked || dirtyFields.summary || dirtyFields.description);
  const unavailable = connection?.connected !== true || connection?.automaticSyncEnabled === false
    || connection?.mode === 'manual' || connection?.failures > 0 || connection?.missingStates?.length || state?.blocked||planNeedsReview(state);
  return pending && !!unavailable;
}
export const hasMeaningfulNotes = text => Boolean(String(text||'').replace(/^_Migrated from ClickUp:.*_\s*$/gm,'').replace(/^\s*---\s*$/gm,'').trim());
export const same = (a,b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
export function statusOf(value){
  if(['Done','Fixed','Complete'].includes(value)) return 'green';
  if(['Standby','Prompt Ready'].includes(value)) return 'blue';
  if(['Critical / Debugging','Critical','Debugging','Blocked'].includes(value)) return 'red';
  if(value==='In Development')return 'purple';
  if(value==='In Progress') return 'yellow';
  return 'grey';
}
export function rollup(colors){
  if(!colors.length) return null;
  if(colors.includes('red')) return 'red';
  if(colors.includes('purple'))return 'purple';
  if(colors.every(x=>x==='grey')) return 'grey';
  if(colors.some(x=>x==='grey'||x==='yellow')) return 'yellow';
  if(colors.includes('blue')) return 'blue';
  return 'green';
}
export function indexTree(items,order={}){
  const byId=new Map(items.map(x=>[x.id,x])), children=new Map();
  for(const item of items){const key=byId.has(item.parentId)?item.parentId:null;if(!children.has(key))children.set(key,[]);children.get(key).push(item);}
  for(const list of children.values()) list.sort((a,b)=>(order[a.id]??Number.MAX_SAFE_INTEGER)-(order[b.id]??Number.MAX_SAFE_INTEGER)||a.id.localeCompare(b.id,undefined,{numeric:true}));
  const depths=new Map(),colors=new Map(),visiting=new Set();
  function visit(item,depth){if(visiting.has(item.id))throw new Error('A circular parent relationship was found.');visiting.add(item.id);depths.set(item.id,depth);const kids=children.get(item.id)||[];kids.forEach(c=>visit(c,depth+1));colors.set(item.id,rollup(kids.map(c=>colors.get(c.id)))||statusOf(item.assignedState??item.state));visiting.delete(item.id);}
  (children.get(null)||[]).forEach(x=>visit(x,0));
  if(depths.size!==items.length)throw new Error('The hierarchy contains an unreachable cycle.');
  return {byId,children,depths,colors};
}
export function descendants(items,id){const tree=indexTree(items),out=[];function walk(key){for(const child of tree.children.get(key)||[]){out.push(child.id);walk(child.id);}}walk(id);return out;}
export function validateMove(items,id,parentId){
  if(!items.some(x=>x.id===id))throw new Error('Item no longer exists.');
  if(parentId&&!items.some(x=>x.id===parentId))throw new Error('The destination no longer exists.');
  if(parentId===id||descendants(items,id).includes(parentId))throw new Error('An item cannot be moved inside itself or its descendants.');
}
// A field changed remotely only conflicts when it differs from both the original and desired values.
export function reconcile(base,patch,remote){
  if(!remote)return {patch:{},conflicts:[{field:'__missing__',base,local:patch,remote:null}]};
  const accepted={},conflicts=[];
  for(const [field,value] of Object.entries(patch)){
    if(!isEditableField(field))throw new Error('Unsupported field: '+field);
    if(same(remote[field],value))continue;
    if(same(remote[field],base[field]))accepted[field]=value;
    else conflicts.push({field,base:base[field]??null,local:value,remote:remote[field]??null});
  }
  return {patch:accepted,conflicts};
}
export function materialize(remote,operations){
  const map=new Map(remote.map(x=>[x.id,clone(x)]));
  for(const op of operations){
    if(op.type==='create')map.set(op.issueId,clone(op.item));
    if(op.type==='attachment'&&map.has(op.issueId)){const item=map.get(op.issueId);item.pendingAttachments||=[];item.pendingAttachments.push({id:op.uploadId,opId:op.opId,...clone(op.file)});}
    if(op.type==='attachment-delete'&&map.has(op.issueId)){const item=map.get(op.issueId);item.pendingAttachmentDeletes||=[];item.pendingAttachmentDeletes.push({id:op.attachmentId,opId:op.opId});}
    if(op.type==='edit'&&map.has(op.issueId)){
      const patch={...op.patch};
      if('state'in patch&&!('assignedState'in patch))patch.assignedState=patch.state;
      if('parentId'in patch){
        // Follow the current parent chain instead of rebuilding a full tree for
        // every queued link. Bulk queues still validate each sequential result.
        let invalid=!!patch.parentId&&!map.has(patch.parentId),parent=patch.parentId,seen=new Set();
        while(parent&&!invalid){if(parent===op.issueId||seen.has(parent)){invalid=true;break;}seen.add(parent);parent=map.get(parent)?.parentId;}
        if(invalid)delete patch.parentId;
      }
      Object.assign(map.get(op.issueId),patch);
    }
    if(op.type==='delete')for(const id of op.ids)map.delete(id);
  }
  return [...map.values()];
}
export function remapOperation(op,mapping){
  const next=clone(op),id=x=>mapping[x]||x;
  next.issueId=id(next.issueId);
  if(next.item){next.item.id=id(next.item.id);next.item.parentId=id(next.item.parentId);}
  if(next.patch&&'parentId'in next.patch)next.patch.parentId=id(next.patch.parentId);
  if(next.base&&'parentId'in next.base)next.base.parentId=id(next.base.parentId);
  if(next.ids)next.ids=next.ids.map(id);
  if(next.bases)next.bases=Object.fromEntries(Object.entries(next.bases).map(([k,v])=>[id(k),{...v,parentId:id(v.parentId)}]));
  if(next.group)next.group={...next.group,members:next.group.members.map(id),originParentId:id(next.group.originParentId),destinationParentId:id(next.group.destinationParentId)};
  return next;
}
export function mergeIncoming(state,remote){
  // Do not replace operation baselines: they are the evidence needed for three-way reconciliation.
  indexTree(remote);
  const comments=new Map(state.remote.filter(x=>x.comments).map(x=>[x.id,x.comments]));
  state.remote=remote.map(x=>({...x,comments:x.comments||comments.get(x.id)||[]}));
  return state;
}
export function applySyncResult(state,result){
  for(const group of Object.values(state.bulkGroups||{})){
    group.completed=[...new Set([...group.completed,...result.completed.filter(id=>group.opIds.includes(id))])];
    const mapping=result.mapping||{},id=value=>mapping[value]||value;
    group.members=group.members.map(id);group.originParentId=id(group.originParentId);group.destinationParentId=id(group.destinationParentId);group.createdParentId=id(group.createdParentId);group.entries=group.entries.map(entry=>({...entry,issueId:id(entry.issueId)}));
    if(group.status!=='cancelled')group.status=group.completed.length===group.opIds.length?'complete':result.blocked&&group.opIds.includes(result.blocked.opId)?'blocked':'pending';
  }
  state.operations=state.operations.filter(x=>!result.completed.includes(x.opId)).map(op=>remapOperation(op,result.mapping||{}));
  for(const [old,id]of Object.entries(result.mapping||{})){
    for(const key of ['images','order'])if(old in state[key]){state[key][id]=state[key][old];delete state[key][old];}
    for(const key of ['expanded','selectorExpanded'])state[key]=state[key].map(x=>x===old?id:x);
    if(state.selected===old)state.selected=id;
  }
  if(result.items)mergeIncoming(state,result.items);
  for(const target of result.deletedAttachments||[]){const item=state.remote.find(x=>x.id===target.issueId);if(item)item.attachments=(item.attachments||[]).filter(x=>x.id!==target.id);}
  applyPlanSync(state,result);
  state.blocked=result.blocked||null;
  if(!result.blocked&&!result.error)state.lastSync=result.at;
  return state;
}
export function importIssue(issue){
  const counts=issue.linkedIssueCounts||{};
  return {id:issue.id,summary:issue.summary,description:issue.description||'',parentId:issue.parentIssue?.id||null,state:issue.customFields?.State||'To do',priority:issue.customFields?.Priority||'Normal',complexity:issue.customFields?.Complexity??null,type:issue.customFields?.Type||'Task',updated:issue.updatedAt,comments:(issue.recentComments||[]).map((c,i)=>({id:'import-'+i,text:c.text,author:c.author,created:c.created})),commentCount:issue.totalComments||0,dependencies:Object.entries(counts).filter(([k])=>!['parent for','subtask of'].includes(k)).reduce((a,[,v])=>a+v,0),fields:issue.customFields||{},url:issue.url};
}
