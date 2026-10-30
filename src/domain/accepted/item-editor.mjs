import {STATES,same,clone} from './core.mjs';
import {PRIORITIES,COMPLEXITIES} from './field-tags.mjs';

export function dateText(value){
 if(value===null||value===undefined||value==='')return null;
 if(typeof value==='number'){if(!Number.isFinite(value))throw Error('Invalid Due Date.');return new Date(value).toISOString().slice(0,10);}
 dateTimestamp(value);return value;
}
// YouTrack DateIssueCustomField stores midday UTC, not local midnight.
export function dateTimestamp(value){
 if(value===null||value==='')return null;
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Choose a Valid Due Date.');
 const timestamp=Date.parse(value+'T12:00:00.000Z');
 if(!Number.isFinite(timestamp)||new Date(timestamp).toISOString().slice(0,10)!==value)throw Error('Choose a Valid Due Date.');return timestamp;
}
export function assigneeValue(raw){return Array.isArray(raw)?raw.map(x=>x.id||x.login):raw?.id??raw?.login??null;}
export function editorValues(item){
 const raw=name=>item._custom?.find(x=>x.name===name)?.value;
 return {summary:item.summary||'',description:item.description||'',assignedState:item.assignedState??item.state??'To do',priority:item.priority??'Normal',complexity:item.complexity??null,assignee:item.assignee!==undefined?clone(item.assignee):assigneeValue(raw('Assignee')),dueDate:dateText(item.dueDate!==undefined?item.dueDate:raw('Due Date')??item.fields?.['Due Date']??null),tags:[...(item.tags||[])].sort()};
}
export function editorConfiguration(schema,users=null,userError=''){
 const assignee=schema.find(x=>x.field?.name==='Assignee'),dueDate=schema.find(x=>x.field?.name==='Due Date');
 const single=assignee?.field?.fieldType?.id==='user[1]'||assignee?.field?.fieldType?.valueType==='user'&&assignee?.field?.fieldType?.isMultiValue===false;
 const date=dueDate?.field?.fieldType?.id==='date'||!dueDate?.field?.fieldType?.id&&dueDate?.field?.fieldType?.valueType==='date';
 return {
  assignee:{ready:!!single&&Array.isArray(users),canBeEmpty:assignee?.canBeEmpty===true,options:users?.filter(x=>x.id&&x.login).map(x=>({id:x.id,login:x.login,name:x.fullName||x.name||x.login}))||[],message:!assignee?'Assignee Is Not Available in This Project.':!single?'This Assignee Field Is Not Single-Choice.':userError||(!users?'Assignee Options Are Not Available.':'')},
  dueDate:{ready:!!date,canBeEmpty:dueDate?.canBeEmpty===true,message:!dueDate?'Due Date Is Not Available in This Project.':!date?'This Due Date Field Is Not Date-Only.':''}
 };
}
export function editorPatch(base,values,configuration){
 const next={...values,summary:same(values.summary,base.summary)?base.summary:values.summary.trim(),complexity:values.complexity||null,assignee:values.assignee||null,dueDate:values.dueDate||null};
 if(!next.summary)throw Error('Enter an Item Name.');const patch={};
 for(const key of Object.keys(base))if(!same(base[key],next[key]))patch[key]=next[key];
 if('assignedState'in patch&&!Object.values(STATES).includes(patch.assignedState))throw Error('Choose a Supported Assigned Status.');
 if('priority'in patch&&!PRIORITIES.some(x=>x.value===patch.priority))throw Error('Choose LOW, NORMAL, HIGH or URGENT for Priority.');
 if('complexity'in patch&&patch.complexity!==null&&!COMPLEXITIES.some(x=>x.value===patch.complexity))throw Error('Choose LOW, MID, HIGH, INSANE or Not Set for Complexity.');
 if('assignee'in patch){const field=configuration?.assignee;if(!field?.ready)throw Error(field?.message||'Assignee Options Are Not Available.');if(patch.assignee===null){if(!field.canBeEmpty)throw Error('This Project Requires an Assignee.');}else if(!field.options.some(x=>x.id===patch.assignee))throw Error('Choose an Eligible Project Assignee.');}
 if('dueDate'in patch){const field=configuration?.dueDate;if(!field?.ready)throw Error(field?.message||'Due Date Is Not Available.');if(patch.dueDate===null&&!field.canBeEmpty)throw Error('This Project Requires a Due Date.');dateTimestamp(patch.dueDate);}
 if('tags'in patch){if(!configuration?.tags?.ready)throw Error('Tag Options Are Not Available.');if(!Array.isArray(patch.tags)||patch.tags.some(id=>!configuration.tags.options.some(x=>x.id===id)&&!base.tags.includes(id)))throw Error('Choose an Available Tag.');patch.tags=[...new Set(patch.tags)].sort();}
 return patch;
}
