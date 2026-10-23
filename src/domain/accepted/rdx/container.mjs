import {Buffer} from 'buffer/index.js';
import {parseJSON,canonical,sha,unique} from '../content/contracts.mjs';
import {validateShape} from './schema.mjs';
import {validateDocument,requireCapabilities} from './document.mjs';
import {operation,ensure} from './limits.mjs';
export const MAGIC=Buffer.from('ROMDXR01');
export const DEFAULT_LEVEL=9;
const LEGACY=Buffer.from('ROMDEXM1');
export function identifyInput(bytes){
 ensure(Buffer.isBuffer(bytes),'INVALID','RDX Input Must Be Bytes.');
 if(bytes.subarray(0,8).equals(MAGIC))return {route:'rdx',validated:false};
 if(bytes.subarray(0,8).equals(LEGACY))return {route:'legacy-migration',validated:false,handler:'desktop/migration.mjs'};
 if(bytes.subarray(0,6).toString()==='ROMDXR')return {route:'unsupported-rdx',validated:false};
 if(bytes.length<=8*1024*1024){
  try{const value=parseJSON(bytes,{maxBytes:8*1024*1024});if(value.format==='NPCDexMapImport/1')return {route:'legacy-map-json',validated:false,handler:'content/catalog.mjs:buildContentImport'};}catch{}
 }
 return {route:'unknown',validated:false};
}
async function transformBytes(bytes,mode,maximum,op){
 op.check();let length=0;const chunks=[];
 const codec=mode==='inflate'?new DecompressionStream('deflate-raw'):new CompressionStream('deflate-raw');
 const stream=new Blob([Uint8Array.from(bytes)]).stream().pipeThrough(codec),reader=stream.getReader();
 const abort=()=>{reader.cancel(op.signal.reason).catch(()=>{});};
 op.signal.addEventListener('abort',abort,{once:true});
 try{
  for(;;){op.check();const {done,value}=await reader.read();op.check();if(done)break;length+=value.length;ensure(length<=maximum,'LIMIT','RDX Decoded or Compressed Entry Limit Exceeded.');chunks.push(Buffer.from(value));}
 }finally{op.signal.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});}
 op.check();return Buffer.concat(chunks,length);
}
export async function packRdx(documentBytes,blobs=new Map(),options={}){
 const op=operation(options);try{
  ensure(options.level===undefined||options.level===DEFAULT_LEVEL,'UNSUPPORTED','Browser compression levels are selected by the platform.');
  ensure(blobs instanceof Map,'INVALID','RDX Blobs Must Be Hash-Keyed.');
  const {document,canonicalBytes}=validateDocument(documentBytes,{blobs,limits:op.limits,check:op.check});
  ensure(blobs.size+1<=op.limits.entries,'LIMIT','RDX Entry Count Limit Exceeded.');
  const entries=[],bodies=[];let offset=0,decoded=0;
  for(const [id,bytes]of [['document',canonicalBytes],...[...blobs].sort(([a],[b])=>a.localeCompare(b)).map(([h,b])=>['blob:'+h,b])]){
   op.check();decoded+=bytes.length;ensure(decoded<=op.limits.decoded,'LIMIT','RDX Decoded Aggregate Limit Exceeded.');
   const compressed=options.compress===false?null:await transformBytes(bytes,'deflate',bytes.length+65536,op);
   const stored=compressed&&compressed.length<bytes.length?compressed:bytes;
   entries.push({id,codec:stored===bytes?'store':'deflate-raw',offset,storedBytes:stored.length,decodedBytes:bytes.length,sha256:sha(bytes)});
   bodies.push(stored);offset+=stored.length;ensure(offset<=op.limits.stored,'LIMIT','RDX Stored File Limit Exceeded.');
  }
  const manifest={format:'RDXContainer/1',documentRevision:document.revision,requiredCapabilities:['org.romdex.rdx.container-v1'],entries};validateShape(manifest,'container');
  const header=Buffer.from(canonical(manifest));ensure(header.length<=op.limits.manifest,'LIMIT','RDX Manifest Limit Exceeded.');
  ensure(12+header.length+offset<=op.limits.stored,'LIMIT','RDX Stored File Limit Exceeded.');
  const prefix=Buffer.alloc(12);MAGIC.copy(prefix);prefix.writeUInt32LE(header.length,8);op.check();
  return Buffer.concat([prefix,header,...bodies],12+header.length+offset);
 }finally{op.close();}
}
export async function unpackRdx(bytes,options={}){
 const op=operation(options);try{
  ensure(Buffer.isBuffer(bytes)&&bytes.length>=8,'INVALID','Incomplete RDX Header.');op.check();
  ensure(bytes.length<=op.limits.stored,'LIMIT','RDX Stored File Limit Exceeded.');
  const route=identifyInput(bytes).route;ensure(route==='rdx','UNSUPPORTED',route==='legacy-migration'?'Legacy Browser Migration: Use Its Dedicated Migration Reader.':route==='legacy-map-json'?'Legacy Map JSON: Use Import Map Data.':'Unsupported RDX Framing or Version.');
  ensure(bytes.length>=12,'INVALID','Incomplete RDX Header.');
  const headerLength=bytes.readUInt32LE(8);ensure(headerLength>0&&headerLength<=op.limits.manifest,'LIMIT','RDX Manifest Limit Exceeded.');
  const start=12+headerLength;ensure(start<=bytes.length,'INVALID','Incomplete RDX Manifest.');
  const manifest=parseJSON(bytes.subarray(12,start),{maxBytes:op.limits.manifest,maxDepth:op.limits.depth,maxNodes:op.limits.nodes});
  ensure(manifest.format==='RDXContainer/1','UNSUPPORTED','Unsupported RDX Container Version.');
  requireCapabilities(manifest.requiredCapabilities);
  if(manifest.entries?.some(e=>!['store','deflate-raw'].includes(e.codec)))ensure(false,'UNSUPPORTED','Unsupported RDX Entry Codec.');
  validateShape(manifest,'container');ensure(manifest.entries.length<=op.limits.entries,'LIMIT','RDX Entry Count Limit Exceeded.');
  unique(manifest.entries.map(e=>e.id),'RDX Entry');ensure(manifest.entries.filter(e=>e.id==='document').length===1,'INVALID','RDX Requires Exactly One Document.');
  let offset=0,decoded=0;
  for(const entry of manifest.entries){
   op.check();const maximum=entry.id==='document'?op.limits.json:op.limits.blob;
   ensure(entry.offset===offset,'INVALID','RDX Entry Gap or Overlap.');
   ensure(entry.decodedBytes<=maximum&&entry.storedBytes<=maximum+65536,'LIMIT','RDX Entry Byte Limit Exceeded.');
   ensure(entry.codec!=='store'||entry.storedBytes===entry.decodedBytes,'INVALID','RDX Stored Entry Lengths Differ.');
   ensure(entry.id==='document'||entry.id==='blob:'+entry.sha256,'INVALID','RDX Blob Identity Differs.');
   offset+=entry.storedBytes;decoded+=entry.decodedBytes;
   ensure(Number.isSafeInteger(offset)&&offset<=bytes.length-start,'INVALID','RDX Body Is Truncated.');
   ensure(decoded<=op.limits.decoded,'LIMIT','RDX Decoded Aggregate Limit Exceeded.');
  }
  ensure(offset===bytes.length-start,'INVALID','Unlisted RDX Trailing Bytes.');
  const blobs=new Map();let documentBytes;
  for(const entry of manifest.entries){
   op.check();const stored=bytes.subarray(start+entry.offset,start+entry.offset+entry.storedBytes);
   const body=entry.codec==='store'?Buffer.from(stored):await transformBytes(stored,'inflate',entry.decodedBytes,op);
   ensure(body.length===entry.decodedBytes&&sha(body)===entry.sha256,'INVALID','RDX Entry Hash or Decoded Length Differs.');
   if(entry.id==='document')documentBytes=body;else blobs.set(entry.sha256,body);
  }
  const validated=validateDocument(documentBytes,{blobs,limits:op.limits,check:op.check});
  ensure(documentBytes.equals(validated.canonicalBytes),'INVALID','RDX Document Entry Must Use Canonical JSON.');
  ensure(manifest.documentRevision===validated.document.revision,'INVALID','RDX Manifest and Document Revisions Differ.');
  return {...validated,manifest,documentBytes,blobs,containerSha256:sha(bytes)};
 }finally{op.close();}
}
