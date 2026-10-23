import schemaData from './contracts-schema.mjs';
import nativeData from '../content/contracts-schema.mjs';
import {parseJSON, canonical, requireThat} from '../content/contracts.mjs';

// A fail-closed evaluator for the two pinned local contracts, not a general
// JSON Schema engine. Imported schema URLs are never resolved or downloaded.
export const schema=schemaData;
const native=nativeData;
const resources=new Map([[schema.$id,schema],[native.$id,native]]);
requireThat(canonical(schema.$defs.native)===canonical(native),'Native RDX Contract Changed Without Compatibility Review.');
const keywords=new Set(['$schema','$id','$defs','$ref','title','description','type','properties','required','additionalProperties','propertyNames','items','minItems','uniqueItems','minLength','minimum','maximum','pattern','enum','const','oneOf','anyOf','allOf','if','then']);
function resolve(ref,resource){
 const [id,fragment='']=ref.split('#'),base=id?resources.get(id):resource;
 requireThat(base,'Unknown Local RDX Schema Resource.');let target=base;
 for(const part of fragment.split('/').slice(1))target=target?.[part.replace(/~1/g,'/').replace(/~0/g,'~')];
 requireThat(target&&typeof target==='object','Unknown Local RDX Schema Reference.');return [target,base];
}
function lint(rule,resource){
 for(const key of Object.keys(rule))requireThat(keywords.has(key),'Unsupported RDX Schema Keyword: '+key);
 if(rule.$ref)resolve(rule.$ref,resource);
 for(const key of ['$defs','properties'])for(const child of Object.values(rule[key]||{}))lint(child,child.$id?child:resource);
 for(const key of ['allOf','oneOf','anyOf'])for(const child of rule[key]||[])lint(child,resource);
 for(const key of ['if','then','items','propertyNames','additionalProperties'])if(rule[key]&&typeof rule[key]==='object')lint(rule[key],resource);
}
lint(schema,schema);lint(native,native);
const equal=(a,b)=>canonical(a)===canonical(b);
function conforms(v,s,resource,budget){
 requireThat(--budget.left>=0,'RDX Schema Work Limit Exceeded.');
 if(s.$ref){const [target,next]=resolve(s.$ref,resource);if(!conforms(v,target,next,budget))return false;}
 const test=rule=>conforms(v,rule,resource,budget);
 if('const'in s&&!equal(v,s.const)||s.enum&&!s.enum.some(x=>equal(x,v)))return false;
 if(s.oneOf&&s.oneOf.filter(test).length!==1||s.anyOf&&!s.anyOf.some(test)||s.allOf&&!s.allOf.every(test))return false;
 if(s.if&&test(s.if)&&s.then&&!test(s.then))return false;
 const type=v===null?'null':Array.isArray(v)?'array':typeof v;
 if(s.type&&s.type!==type&&!(s.type==='integer'&&Number.isSafeInteger(v)))return false;
 if(type==='string'&&(s.minLength!==undefined&&[...v].length<s.minLength||s.pattern&&!new RegExp(s.pattern).test(v)))return false;
 if(type==='number'&&(s.minimum!==undefined&&v<s.minimum||s.maximum!==undefined&&v>s.maximum))return false;
 if(type==='array'&&(s.minItems!==undefined&&v.length<s.minItems||s.uniqueItems&&new Set(v.map(canonical)).size!==v.length||s.items&&!v.every(x=>conforms(x,s.items,resource,budget))))return false;
 if(type==='object'){
  if((s.required||[]).some(k=>!Object.hasOwn(v,k)))return false;
  for(const [k,child]of Object.entries(v)){
   if(s.propertyNames&&!conforms(k,s.propertyNames,resource,budget))return false;
   if(Object.hasOwn(s.properties||{},k)){if(!conforms(child,s.properties[k],resource,budget))return false;}
   else if(s.additionalProperties===false)return false;
   else if(s.additionalProperties&&typeof s.additionalProperties==='object'&&!conforms(child,s.additionalProperties,resource,budget))return false;
  }
 }
 return true;
}
export function validateShape(value,definition){
 requireThat(Object.hasOwn(schema.$defs,definition),'Unknown RDX Contract.');
 requireThat(conforms(value,schema.$defs[definition],schema,{left:2000000}),'Invalid RDX '+definition+' Structure.');return value;
}
