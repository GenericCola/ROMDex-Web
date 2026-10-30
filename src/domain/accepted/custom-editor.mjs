import {dateText,dateTimestamp} from './item-editor.mjs';
const standard=new Set(['State','Priority','Complexity','Assignee','Due Date']);
export const customKey=id=>'custom:'+id;
export function customValue(field){
 const value=field.value;if(value==null)return null;
 if(field.$type==='DateIssueCustomField')return dateText(value);
 if(field.$type==='PeriodIssueCustomField')return value.minutes??null;
 if(field.$type==='TextIssueCustomField')return value.text??'';
 const one=v=>typeof v==='object'?v.id??v.name??v.login??null:v;
 return Array.isArray(value)?value.map(one).sort():one(value);
}
export function customDefinitions(schema,timeTracking){
 return schema.filter(x=>!standard.has(x.field?.name)).map(spec=>{
  const type=spec.field?.fieldType||{},id=type.id||'',kind=type.valueType||id.replace(/\[.*$/,''),multi=type.isMultiValue===true||id.endsWith('[*]');
  const choices=['enum','state','build','version','ownedField','group','user'].includes(kind);
  const supported=choices||['integer','float','string','text','period','date','boolean'].includes(kind);
  const spent=timeTracking?.timeSpent;
  const matchesSpent=!!spent&&(spent.id===spec.id||!!spent.field?.id&&spent.field.id===spec.field?.id||!!spent.field?.name&&spent.field.name===spec.field?.name);
  const calculated=kind==='period'&&(spec.field?.name.toLowerCase()==='spent time'||matchesSpent);
  return {id:spec.id,key:customKey(spec.id),name:spec.field?.name,type:kind,multi,choices,options:(spec.bundle?.values||spec.bundle?.aggregatedUsers||[]).map(v=>({id:v.id||v.login||v.name,name:v.fullName||v.name||v.login})),canBeEmpty:spec.canBeEmpty===true,readOnly:!supported||calculated,message:calculated?'Calculated from YouTrack Work Logs.':!supported?'This Field Type Is Read-Only in ROMDex.':''};
 });
}
export function periodText(minutes){if(minutes==null)return '';const h=Math.floor(minutes/60),m=minutes%60;return [h?h+'h':'',m?m+'m':''].filter(Boolean).join(' ')||'0m';}
export function parseCustomInput(def,value){
 if(def.choices)return def.multi?value.filter(Boolean).sort():value||null;
 if(value===''||value==null)return null;
 if(def.type==='integer'||def.type==='float'){const n=Number(value);if(!Number.isFinite(n)||def.type==='integer'&&!Number.isSafeInteger(n))throw Error('Enter a Valid Number for '+def.name+'.');return n;}
 if(def.type==='period'){
  const text=String(value).trim(),parts=[...text.matchAll(/(\d+)\s*([hm])/gi)];
  if(!parts.length||text.replace(/(\d+)\s*([hm])/gi,'').trim())throw Error('Use Hours and Minutes for '+def.name+', for Example 2h 30m.');
  const minutes=parts.reduce((n,p)=>n+Number(p[1])*(p[2].toLowerCase()==='h'?60:1),0);if(!Number.isSafeInteger(minutes))throw Error('Enter a Valid Period.');return minutes;
 }
 if(def.type==='date'){dateTimestamp(value);return value;}
 if(def.type==='boolean')return value===true||value==='true';
 return value;
}
export function validateCustomValue(def,value){
 if(!def||def.readOnly)throw Error(def?.message||'This Project Field Is Not Editable.');
 if(value===null||Array.isArray(value)&&!value.length){if(!def.canBeEmpty)throw Error(def.name+' Cannot Be Empty.');return;}
 if(def.choices){const values=def.multi?value:[value];if(!Array.isArray(values)||values.some(v=>!def.options.some(x=>x.id===v)))throw Error('Choose a Configured Value for '+def.name+'.');}
 else if(def.type==='integer'&&!Number.isSafeInteger(value)||def.type==='float'&&(typeof value!=='number'||!Number.isFinite(value))||def.type==='period'&&(!Number.isSafeInteger(value)||value<0)||['string','text'].includes(def.type)&&typeof value!=='string'||def.type==='boolean'&&typeof value!=='boolean')throw Error('Invalid Value for '+def.name+'.');
 if(def.type==='date')dateTimestamp(value);
}
export function customPayload(def,value){
 validateCustomValue(def,value);
 const single={enum:'SingleEnumIssueCustomField',state:'StateIssueCustomField',user:'SingleUserIssueCustomField',build:'SingleBuildIssueCustomField',version:'SingleVersionIssueCustomField',ownedField:'SingleOwnedIssueCustomField',group:'SingleGroupIssueCustomField'},multi={enum:'MultiEnumIssueCustomField',user:'MultiUserIssueCustomField',build:'MultiBuildIssueCustomField',version:'MultiVersionIssueCustomField',ownedField:'MultiOwnedIssueCustomField',group:'MultiGroupIssueCustomField'};
 const type=def.choices?(def.multi?multi[def.type]:single[def.type]):def.type==='date'?'DateIssueCustomField':def.type==='period'?'PeriodIssueCustomField':def.type==='text'?'TextIssueCustomField':'SimpleIssueCustomField';
 if(!type)throw Error('Unsupported Field Cardinality.');
 const native=value===null?null:def.choices?(def.multi?value.map(id=>({id})):{id:value}):def.type==='date'?dateTimestamp(value):def.type==='period'?{minutes:value}:def.type==='text'?{text:value}:value;
 return {id:def.id,name:def.name,$type:type,value:native};
}
