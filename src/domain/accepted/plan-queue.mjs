// Durable local ledger, stored in the same transaction as its native operations.
// Only the host's reviewed RDX planner supplies batches; no backend IDs come from
// the portable file. This module does not perform network requests.
export function stageReviewedPlan(state,batch){
 state.rdxImports??={};const ledger=state.rdxImports[batch.key]??{tasks:{},batches:{}};
 if(ledger.batches[batch.batchId])return {alreadyQueued:true,batch:ledger.batches[batch.batchId]};
 const ids=new Set(state.operations.map(o=>o.opId));if(batch.operations.some(o=>ids.has(o.opId)))throw Error('A Plan Operation ID Already Exists Outside Its Import Ledger.');
 state.operations.push(...structuredClone(batch.operations));
 state.order={...state.order,...batch.order};
 ledger.tasks=structuredClone(batch.bindings);ledger.batches[batch.batchId]={id:batch.batchId,revision:batch.revision,destination:batch.destination,taskIds:batch.taskIds,opIds:batch.operations.map(o=>o.opId),entries:batch.operations.map(o=>({opId:o.opId,type:o.type,issueId:o.issueId})),completed:[],status:batch.operations.length?'pending':'complete'};
 state.rdxImports[batch.key]=ledger;return {alreadyQueued:false,batch:ledger.batches[batch.batchId]};
}
export function applyPlanSync(state,result){
 const mapping=result.mapping||{},id=value=>mapping[value]||value;
 for(const ledger of Object.values(state.rdxImports||{})){
  for(const binding of Object.values(ledger.tasks)){binding.issueId=id(binding.issueId);if(binding.desired)binding.desired.parentId=id(binding.desired.parentId);}
  for(const batch of Object.values(ledger.batches)){
   const wasComplete=batch.status==='complete';
   batch.destination=id(batch.destination);batch.entries=batch.entries.map(e=>({...e,issueId:id(e.issueId)}));batch.completed=[...new Set([...batch.completed,...result.completed.filter(op=>batch.opIds.includes(op))])];
   const pending=new Set(state.operations.map(o=>o.opId));batch.status=batch.completed.length===batch.opIds.length?'complete':result.blocked&&batch.opIds.includes(result.blocked.opId)?'blocked':batch.opIds.some(op=>!pending.has(op)&&!batch.completed.includes(op))?'needs-review':'pending';
   if(batch.status==='complete'&&!wasComplete)for(const taskId of batch.taskIds){const binding=ledger.tasks[taskId],current=state.remote.find(i=>i.id===binding?.issueId);if(current)binding.nativeUpdated=current.updated;}
  }
 }
}
