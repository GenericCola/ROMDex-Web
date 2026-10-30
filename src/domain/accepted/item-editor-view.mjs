import {STATUS,STATES,statusOf,clone,same,materialize} from './core.mjs';
import {PRIORITIES,COMPLEXITIES} from './field-tags.mjs';
import {editorValues,editorPatch} from './item-editor.mjs';
import {customValue,periodText,parseCustomInput,validateCustomValue} from './custom-editor.mjs';
const $=id=>document.getElementById(id),label=name=>String(name).replace(/\b\w/g,c=>c.toUpperCase());
const fields={summary:'edit-name',description:'edit-description',assignedState:'edit-status',priority:'edit-priority',complexity:'edit-complexity',assignee:'edit-assignee',dueDate:'edit-due-date'};
export class ItemEditor {
 constructor({ws,esc,onSaved}){
  this.ws=ws;this.esc=esc;this.onSaved=onSaved;this.session=null;this.saving=false;
  $('item-edit-form').onsubmit=e=>{e.preventDefault();this.save();};
  $('edit-status').onchange=()=>this.statusLight();
  $('item-edit-dialog').addEventListener('close',()=>{this.session=null;});
  $('item-edit-dialog').addEventListener('cancel',e=>{if(this.saving)e.preventDefault();});
 }
 values(item,config){const base=editorValues(item);for(const def of config?.custom||[])base[def.key]=item[def.key]!==undefined?clone(item[def.key]):customValue(item._custom?.find(x=>x.id===def.id)||{value:null});return base;}
 options(element,choices,value,empty=null){
  const esc=this.esc;let list=empty!==null?[{value:'',label:empty},...choices]:choices;
  if(value!=null&&!list.some(x=>x.value===value))list=[{value,label:value==='Show-stopper'?'URGENT · Current YouTrack Show-stopper':'Current: '+value},...list];
  element.innerHTML=list.map(x=>`<option value="${esc(x.value)}">${esc(x.label)}</option>`).join('');element.value=value??'';
 }
 setStandard(key,value){
  const element=$(fields[key]);
  if(key==='assignedState')this.options(element,Object.entries(STATUS).map(([color,name])=>({value:STATES[color],label:name})),value);
  else if(key==='priority')this.options(element,PRIORITIES,value);
  else if(key==='complexity')this.options(element,COMPLEXITIES,value,'Not Set');
  else element.value=value??'';
 }
 rawCustom(def,base){const value=base[def.key];return def.type==='period'?periodText(value):def.multi?(value||[]):value==null?'':String(value);}
 customElements(){return new Map([...$('edit-custom-fields').querySelectorAll('[data-custom-key]')].map(el=>[el.dataset.customKey,el]));}
 readCustom(el,def){return def.multi?[...el.selectedOptions].map(x=>x.value).sort():el.value;}
 tags(){return [...$('edit-tags').querySelectorAll('[data-edit-tag]:checked')].map(x=>x.dataset.editTag).sort();}
 collect(session=this.session){
  const values=clone(session.base);for(const [key,id]of Object.entries(fields))if(!$(id).disabled)values[key]=$(id).value;
  values.complexity=values.complexity||null;values.assignee=values.assignee||null;values.dueDate=values.dueDate||null;
  if(session.config?.tags?.ready)values.tags=this.tags();
  const elements=this.customElements();for(const def of session.config?.custom||[])if(!def.readOnly&&elements.has(def.key)){const raw=this.readCustom(elements.get(def.key),def);values[def.key]=same(raw,this.rawCustom(def,session.base))?clone(session.base[def.key]):parseCustomInput(def,raw);}return values;
 }
 renderExtra(config,base,snapshots=new Map()){
  const esc=this.esc;$('edit-custom-fields').innerHTML=(config?.custom||[]).map(def=>{
   const value=snapshots.has(def.key)?snapshots.get(def.key):this.rawCustom(def,base),disabled=def.readOnly?'disabled':'',caption=label(def.name);
   let control;
   if(def.choices){const options=[...def.options],selected=def.multi?value:[value];for(const id of selected||[])if(id&&!options.some(x=>x.id===id))options.unshift({id,name:'Current: '+id});control=`<select data-custom-key="${esc(def.key)}" aria-label="${esc(caption)}" ${def.multi?'multiple':''} ${disabled}>${!def.multi?`<option value="">${def.canBeEmpty?'Not Set':'Current: Not Set'}</option>`:''}${options.map(x=>`<option value="${esc(x.id)}" ${selected?.includes(x.id)?'selected':''}>${esc(x.name)}</option>`).join('')}</select>`;}
   else if(def.type==='text')control=`<textarea data-custom-key="${esc(def.key)}" aria-label="${esc(caption)}" rows="3" ${disabled}>${esc(value)}</textarea>`;
   else if(def.type==='boolean')control=`<select data-custom-key="${esc(def.key)}" aria-label="${esc(caption)}" ${disabled}><option value="" ${value===''?'selected':''}>Not Set</option><option value="true" ${value==='true'?'selected':''}>Yes</option><option value="false" ${value==='false'?'selected':''}>No</option></select>`;
   else control=`<input data-custom-key="${esc(def.key)}" aria-label="${esc(caption)}" type="${def.type==='date'?'date':def.type==='integer'||def.type==='float'?'number':'text'}" ${def.type==='integer'?'step="1"':def.type==='float'?'step="any"':''} value="${esc(value)}" ${def.type==='period'?'placeholder="2h 30m"':''} ${disabled}>`;
   return `<label class="edit-field">${esc(caption)}${control}${def.message?`<small>${esc(def.message)}</small>`:def.type==='period'?'<small>Hours and Minutes, e.g. 2h 30m</small>':''}</label>`;
  }).join('');
 }
 renderOptions(session,{fresh=null}={}){
  const old=session.config,config=session.nextConfig||old,base=session.base,extras=new Map(),dirtyExtras=new Set();let assigneeChoice=session.renderedOptions?$('edit-assignee').value:base.assignee??'',tagChoice=session.renderedTags?this.tags():base.tags;
  const elements=this.customElements();for(const def of old?.custom||[])if(elements.has(def.key)){const value=this.readCustom(elements.get(def.key),def);extras.set(def.key,value);if(!same(value,this.rawCustom(def,base)))dirtyExtras.add(def.key);}
  if(fresh){const incoming=this.values(fresh,config);for(const [key,id]of Object.entries(fields))if(same($(id).value,base[key]??'')||key==='assignee'&&!session.renderedOptions){base[key]=incoming[key];if(key==='assignee')assigneeChoice=incoming[key]??'';else this.setStandard(key,incoming[key]);}
   for(const def of config?.custom||[])if(!dirtyExtras.has(def.key)){base[def.key]=incoming[def.key];extras.delete(def.key);}
   if(same(tagChoice,base.tags)){base.tags=incoming.tags;tagChoice=incoming.tags;}
  }
  session.unavailableEdits=[...dirtyExtras].filter(key=>!config?.custom?.some(x=>x.key===key));session.config=config;delete session.nextConfig;
  const assignee=$('edit-assignee');this.options(assignee,(config?.assignee?.options||[]).map(x=>({value:x.id,label:x.name+' ('+x.login+')'})),assigneeChoice,config?.assignee?.canBeEmpty?'Unassigned':base.assignee==null?'Current: Unassigned':null);assignee.disabled=!config?.assignee?.ready;session.renderedOptions=true;
  $('edit-due-date').disabled=!config?.dueDate?.ready;$('edit-assignee-hint').textContent=config?.assignee?.message||'';$('edit-date-hint').textContent=config?.dueDate?.message||'';
  const chosen=tagChoice,options=[...(config?.tags?.options||[])];for(const id of chosen)if(!options.some(x=>x.id===id))options.push({id,name:'Current: '+id});
  $('edit-tags').innerHTML=options.length?options.map(tag=>`<label><input type="checkbox" data-edit-tag="${this.esc(tag.id)}" ${chosen.includes(tag.id)?'checked':''} ${!config?.tags?.ready?'disabled':''}>${this.esc(tag.name)}</label>`).join(''):'<span class="muted small">No Available Tags</span>';session.renderedTags=true;
  $('edit-tags-hint').textContent=config?.tags?.message||'';this.renderExtra(config,base,extras);
  this.statusLight();
 }
 async open(item,{displayStatus=null,parent=false}={}){
  const config=this.ws.state.editOptions||null,session={id:item.id,base:this.values(item,config),config,unavailableEdits:[]};this.session=session;
  $('edit-error').textContent='';$('edit-target').textContent=item.id.startsWith('local-')?'New Item · Pending':item.id;
  this.options($('edit-status'),Object.entries(STATUS).map(([color,name])=>({value:STATES[color],label:name})),session.base.assignedState);
  this.options($('edit-priority'),PRIORITIES,session.base.priority);this.options($('edit-complexity'),COMPLEXITIES,session.base.complexity,'Not Set');
  for(const [key,id]of Object.entries(fields))$(id).value=session.base[key]??'';
  $('edit-inherited-hint').textContent=parent?'Displayed Status: '+displayStatus+'. Children Determine the Visible Status; the Assigned Value Appears When This Item Has No Children.':'';
  $('edit-custom-fields').innerHTML='';$('edit-tags').innerHTML='';this.renderOptions(session);
  $('edit-load-message').textContent=this.ws.connected?'Refreshing Project Field Options…':config?'Using Saved Project Field Options.':'Connect to YouTrack to Load Project Field Options.';
  $('item-edit-dialog').showModal();$('edit-name').focus();
  if(!this.ws.connected)return;
  try{const data=await this.ws.loadEditOptions(item.id);if(this.session!==session)return;
   session.nextConfig=data.options;const pending=this.ws.state.operations.filter(x=>x.issueId===session.id);const fresh=data.item?materialize([data.item],pending)[0]:null;this.renderOptions(session,{fresh});$('edit-load-message').textContent='';
  }catch(error){if(this.session===session)$('edit-load-message').textContent=(config?'Using Saved Field Options · ':'Cannot Refresh Field Options · ')+error.message;}
 }
 async save(){
  if(!this.session||this.saving)return;const session=this.session;this.saving=true;this.setBusy(true);$('edit-error').textContent='';
  try{if(session.unavailableEdits.length)throw Error('An Edited Field Was Removed in YouTrack. Cancel and Reopen This Editor.');if(!this.ws.items.some(x=>x.id===session.id))throw Error('This Item No Longer Exists.');
   const patch=editorPatch(session.base,this.collect(session),session.config);for(const [key,value]of Object.entries(patch))if(key.startsWith('custom:'))validateCustomValue(session.config?.custom.find(x=>x.key===key),value);
   if(Object.keys(patch).length)await this.ws.edit(session.id,patch,session.base);$('item-edit-dialog').close();this.onSaved(Object.keys(patch).length);
  }catch(error){$('edit-error').textContent=error.message;}finally{this.saving=false;this.setBusy(false);}
 }
 setBusy(busy){$('item-edit-dialog').querySelectorAll('button').forEach(button=>button.disabled=busy);}
 hasUnsavedChanges(){
  const session=this.session;if(!session||!$('item-edit-dialog').open)return false;
  if(Object.entries(fields).some(([key,id])=>!$(id).disabled&&!same($(id).value,session.base[key]??'')))return true;
  if(session.config?.tags?.ready&&!same(this.tags(),session.base.tags))return true;
  const elements=this.customElements();return (session.config?.custom||[]).some(def=>!def.readOnly&&elements.has(def.key)&&!same(this.readCustom(elements.get(def.key),def),this.rawCustom(def,session.base)));
 }
 statusLight(){if($('edit-status-light'))$('edit-status-light').className='bulb '+statusOf($('edit-status').value);}
 remap(mapping){if(this.session){this.session.id=mapping[this.session.id]||this.session.id;$('edit-target').textContent=this.session.id;}}
}
