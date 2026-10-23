import schemaData from './contracts-schema.mjs';
import {sha256} from '@noble/hashes/sha2.js';
import {Buffer} from 'buffer/index.js';

// Full-data bootstrap is ~266 KiB: use the already proved 512 KiB upload bound.
// Keep manifests single-chunk; no unbounded JSON or upload increase is enabled.
export const MAX_JSON_BYTES=16*1024*1024,CHUNK_BYTES=512*1024,MAX_MANIFEST_BYTES=CHUNK_BYTES;
export const requireThat=(ok,message)=>{if(!ok)throw Error(message);};
export const sha=bytes=>Array.from(sha256(typeof bytes==='string'?new TextEncoder().encode(bytes):bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
export const isHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const forbidden=new Set(['__proto__','constructor','prototype']);
export function canonical(value){
 if(value===null||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='string'){for(let i=0;i<value.length;i++){const c=value.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){const next=value.charCodeAt(++i);requireThat(next>=0xdc00&&next<=0xdfff,'Invalid Unicode.');}else requireThat(c<0xdc00||c>0xdfff,'Invalid Unicode.');}return JSON.stringify(value);}
 if(typeof value==='number'){requireThat(Number.isSafeInteger(value)&&!Object.is(value,-0),'Only Safe Integer JSON Numbers Are Supported.');return String(value);}
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 requireThat(value&&Object.getPrototypeOf(value)===Object.prototype,'Plain JSON Objects Are Required.');
 return '{'+Object.keys(value).sort().map(key=>{requireThat(!forbidden.has(key),'Reserved JSON Key.');return canonical(key)+':'+canonical(value[key]);}).join(',')+'}';
}
export const same=(a,b)=>canonical(a)===canonical(b);
export function seal(value){const key=value.schema==='NPCDexContentRevision/1'?'revisionId':'digest',body={...value};delete body[key];return {...body,[key]:sha(canonical(body))};}
export function verifyDigest(value){const key=value.schema==='NPCDexContentRevision/1'?'revisionId':'digest';requireThat(isHash(value[key]),'Missing Artifact Digest.');requireThat(value[key]===seal(value)[key],'Artifact Digest Does Not Match.');return value[key];}

// Bounded JSON parser: detect duplicate keys before JSON.parse can discard them.
export function parseJSON(bytes,{maxBytes=MAX_JSON_BYTES,maxDepth=64,maxNodes=300000}={}){
 requireThat(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=maxBytes,'JSON Byte Limit Exceeded.');
 requireThat(!(bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf),'UTF-8 BOM Is Not Supported.');
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);let i=0,nodes=0;
 const whitespace=()=>{while(/[ \t\r\n]/.test(text[i]||'!'))i++;};
 const string=()=>{const start=i++;while(i<text.length){const c=text[i++];if(c==='"'){const value=JSON.parse(text.slice(start,i));canonical(value);return value;}if(c==='\\')i++;}throw Error('Unterminated JSON String.');};
 function value(depth){
  requireThat(depth<=maxDepth&&++nodes<=maxNodes,'JSON Complexity Limit Exceeded.');whitespace();const c=text[i];
  if(c==='"')return string();
  if(c==='{'){i++;whitespace();const result={},keys=new Set();if(text[i]==='}'){i++;return result;}for(;;){requireThat(text[i]==='"','Expected JSON Object Key.');const key=string();requireThat(!forbidden.has(key)&&!keys.has(key),'Duplicate or Reserved JSON Key.');keys.add(key);whitespace();requireThat(text[i++]===':','Expected JSON Colon.');result[key]=value(depth+1);whitespace();const end=text[i++];if(end==='}')return result;requireThat(end===',','Expected JSON Object Separator.');whitespace();}}
  if(c==='['){i++;whitespace();const result=[];if(text[i]===']'){i++;return result;}for(;;){result.push(value(depth+1));whitespace();const end=text[i++];if(end===']')return result;requireThat(end===',','Expected JSON Array Separator.');}}
  for(const [word,result]of [['true',true],['false',false],['null',null]])if(text.startsWith(word,i)){i+=word.length;return result;}
  const number=text.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);requireThat(number,'Invalid JSON Value.');i+=number[0].length;const result=Number(number[0]);canonical(result);return result;
 }
 const parsed=value(0);whitespace();requireThat(i===text.length,'Unexpected JSON Trailing Data.');return parsed;
}

// Exact keyword set used by the pinned U20A schema. Not a general schema compiler.
const schema=schemaData;
const keywords=new Set(['$schema','$id','$defs','title','description','$ref','type','enum','const','oneOf','anyOf','allOf','if','then','required','properties','additionalProperties','items','uniqueItems','minItems','minLength','pattern','minimum','maximum']);
function lint(s){for(const key of Object.keys(s))requireThat(keywords.has(key),'Unsupported Contract Schema Keyword.');if(s.$ref)requireThat(/^#\/\$defs\/[a-zA-Z]+$/.test(s.$ref)&&schema.$defs[s.$ref.split('/').at(-1)],'Unknown Contract Schema Reference.');for(const key of ['$defs','properties'])for(const child of Object.values(s[key]||{}))lint(child);for(const key of ['oneOf','anyOf','allOf'])for(const child of s[key]||[])lint(child);for(const key of ['if','then','items','additionalProperties'])if(s[key]&&typeof s[key]==='object')lint(s[key]);}
lint(schema);
export function conforms(value,rule=schema,budget={left:2000000}){
 requireThat(--budget.left>0,'Schema Evaluation Limit Exceeded.');
 if(rule.$ref)return conforms(value,schema.$defs[rule.$ref.split('/').at(-1)],budget);
 if('const'in rule&&!same(value,rule.const))return false;if(rule.enum&&!rule.enum.some(x=>same(x,value)))return false;
 if(rule.oneOf&&rule.oneOf.filter(r=>conforms(value,r,budget)).length!==1)return false;
 if(rule.anyOf&&!rule.anyOf.some(r=>conforms(value,r,budget)))return false;
 if(rule.allOf&&!rule.allOf.every(r=>conforms(value,r,budget)))return false;
 if(rule.if&&conforms(value,rule.if,budget)&&rule.then&&!conforms(value,rule.then,budget))return false;
 const type=value===null?'null':Array.isArray(value)?'array':typeof value;
 if(rule.type&&!(rule.type===type||rule.type==='integer'&&Number.isSafeInteger(value)))return false;
 if(type==='string'&&(rule.minLength!==undefined&&[...value].length<rule.minLength||rule.pattern&&!new RegExp(rule.pattern).test(value)))return false;
 if(type==='number'&&(rule.minimum!==undefined&&value<rule.minimum||rule.maximum!==undefined&&value>rule.maximum))return false;
 if(type==='array'){if(rule.minItems!==undefined&&value.length<rule.minItems)return false;if(rule.uniqueItems&&new Set(value.map(canonical)).size!==value.length)return false;if(rule.items&&!value.every(x=>conforms(x,rule.items,budget)))return false;}
 if(type==='object'){if((rule.required||[]).some(key=>!Object.hasOwn(value,key)))return false;for(const [key,child]of Object.entries(value)){if(rule.properties&&Object.hasOwn(rule.properties,key)){if(!conforms(child,rule.properties[key],budget))return false;}else if(rule.additionalProperties===false)return false;else if(rule.additionalProperties&&typeof rule.additionalProperties==='object'&&!conforms(child,rule.additionalProperties,budget))return false;}}
 return true;
}
export function validateArtifact(bytes,workspace){const artifact=parseJSON(bytes);requireThat(conforms(artifact),'Unsupported or Invalid Content Contract.');requireThat(artifact.workspaceId===workspace,'Content Workspace Does Not Match.');verifyDigest(artifact);return artifact;}
export function unique(values,label){requireThat(new Set(values).size===values.length,'Duplicate '+label+'.');}
export const pointPayload=record=>record.current.payload.points?record.current.payload:record.kind==='shared'&&record.current.payload.sharedType==='global-dialogue'&&record.current.payload.definitions?.points?record.current.payload.definitions:null;
export function validateGraph(records){
 unique(records.map(r=>r.recordId),'Content Record');const byId=new Map(records.map(r=>[r.recordId,r]));
 const get=(id,kind)=>{const r=byId.get(id);requireThat(r&&(!kind||r.kind===kind),'Missing or Mismatched Content Reference.');return r;};
 for(const record of records){
  requireThat(conforms(record),'Invalid Content Record.');verifyDigest(record);const p=record.current.payload;let cursor=record;const visited=new Set([record.recordId]);
  while(cursor.parentRecordId){requireThat(!visited.has(cursor.parentRecordId),'Content Hierarchy Cycle.');visited.add(cursor.parentRecordId);cursor=get(cursor.parentRecordId);}
  if(['region','profile','shared'].includes(record.kind))requireThat(record.parentRecordId===null,'Registry Record Has a Physical Parent.');
  if(record.kind==='map'){get(record.parentRecordId,'region');requireThat(p.regionId===record.parentRecordId,'Map Region Differs.');get(p.timelineRef,'shared');for(const id of p.subzoneIds)requireThat(get(id,'subzone').parentRecordId===record.recordId,'Map Membership Differs.');}
  if(record.kind==='subzone'){const parent=get(record.parentRecordId,'map');requireThat(p.mapId===parent.recordId&&parent.current.payload.subzoneIds.includes(record.recordId),'Sub-Zone Membership Differs.');for(const [key,kind]of [['appearanceIds','appearance'],['sceneIds','scene'],['interactiveIds','interactive']])for(const id of p[key])requireThat(get(id,kind).parentRecordId===record.recordId,'Verse Membership Differs.');}
  if(['appearance','scene','interactive'].includes(record.kind)){const parent=get(record.parentRecordId,'subzone');requireThat(parent.current.payload[{appearance:'appearanceIds',scene:'sceneIds',interactive:'interactiveIds'}[record.kind]].includes(record.recordId),'Inverse Verse Membership Missing.');}
  if(record.kind==='appearance'){for(const id of [p.profileId,...Object.values(p.profileByPlayerGender)].filter(Boolean))get(id,'profile');for(const id of p.sceneIds)get(id,'scene');}
  if(p.participantIds)for(const id of p.participantIds){const participant=get(id,'appearance');if(record.current.lifecycle==='active')requireThat(participant.current.lifecycle==='active','Active Scene Has an Inactive Participant.');}
  const points=pointPayload(record);if(points){unique(points.pointOrder,'Point Order');requireThat(same(Object.keys(points.points).sort(),[...points.pointOrder].sort()),'Point Order Differs.');for(const [id,point]of Object.entries(points.points)){requireThat(conforms(point,schema.$defs.point)&&point.id===id,'Point Identity or Shape Differs.');for(const participant of point.participantIds)get(participant,'appearance');unique(point.blockOrder,'Block Order');requireThat(same(Object.keys(point.blocks).sort(),[...point.blockOrder].sort()),'Block Order Differs.');for(const [key,block]of Object.entries(point.blocks)){requireThat(key===block.id,'Block Identity Differs.');if(block.speaker)get(block.speaker,'profile');}}}
 }
 return byId;
}
