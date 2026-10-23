import {STATES} from './core.mjs';
import {fieldPresentation} from './field-tags.mjs';
export const emptyFilters=()=>({status:'',priority:'',complexity:'',assignee:''});
export const filtersActive=filters=>Object.values(filters).some(Boolean);
export function assignees(item){
 const raw=item._custom?.find(field=>field.name==='Assignee')?.value;
 const values=item.assignee!==undefined?item.assignee:raw;
 return (Array.isArray(values)?values:values?[values]:[]).map(value=>typeof value==='string'?{id:value,name:item.assigneeName||item.fields?.Assignee||value}:{id:value.id||value.login,name:value.fullName||value.name||value.login||value.id});
}
export function matchesFilters(item,tree,filters){return (!filters.status||tree.colors.get(item.id)===filters.status)&&(!filters.priority||item.priority===filters.priority)&&(!filters.complexity||(item.complexity||'')===(filters.complexity==='__unset'?'':filters.complexity))&&(!filters.assignee||(filters.assignee==='__unassigned'?!assignees(item).length:assignees(item).some(person=>person.id===filters.assignee)));}
export function mountTaskFilters({getTree,onChange,beforeOpen}){
 let filters=emptyFilters();const button=document.getElementById('task-filters'),dialog=document.getElementById('task-filter-dialog');
 function populate(field,entries){const select=document.getElementById('filter-'+field);select.replaceChildren(new Option('All '+({status:'Statuses',priority:'Priorities',complexity:'Complexities',assignee:'Assignees'}[field]),''),...entries.map(([value,label])=>new Option(label,value)));select.value=filters[field];}
 function refresh(){const items=[...getTree().byId.values()];populate('status',Object.entries(STATES));populate('priority',[...new Set(items.map(item=>item.priority))].sort().map(value=>[value,fieldPresentation('priority',value).label+(value==='Show-stopper'?' (Show-stopper)':'')]));populate('complexity',[['__unset','Not Set'],...[...new Set(items.map(item=>item.complexity).filter(Boolean))].sort().map(value=>[value,value])]);populate('assignee',[['__unassigned','Unassigned'],...[...new Map(items.flatMap(assignees).map(person=>[person.id,person.name])).entries()].sort((a,b)=>String(a[1]).localeCompare(String(b[1])))]);}
 function changed(){button.setAttribute('aria-pressed',String(filtersActive(filters)));onChange();}
 button.onclick=async()=>{try{await beforeOpen();refresh();dialog.showModal();button.setAttribute('aria-expanded','true');}catch(error){onChange(error);}};
 for(const field of Object.keys(filters))document.getElementById('filter-'+field).onchange=event=>{filters={...filters,[field]:event.target.value};changed();};
 document.getElementById('clear-task-filters').onclick=()=>{filters=emptyFilters();refresh();changed();};
 dialog.addEventListener('close',()=>{button.setAttribute('aria-expanded','false');button.focus();});
 return {get value(){return filters;}};
}
