import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2);
if(args.length!==2)throw Error('Usage: node scripts/export-desktop.mjs <desktop-profile-directory> <new-export-file.json>');
const source=await fs.realpath(path.resolve(args[0])),target=path.resolve(args[1]),targetParent=await fs.realpath(path.dirname(target));
const within=(root,file)=>{const relative=path.relative(root.toLowerCase(),file.toLowerCase());return !relative||(!relative.startsWith('..')&&!path.isAbsolute(relative));};
if(within(source,path.join(targetParent,path.basename(target))))throw Error('Choose an export destination outside the desktop profile.');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const closed=async()=>{
 try{const owner=JSON.parse(await fs.readFile(path.join(source,'desktop-owner.json'),'utf8'));
  for(const pid of [owner.pid,owner.utilityPid])if(Number.isInteger(pid)&&pid>0){
   let live=false;try{process.kill(pid,0);live=true;}catch(error){if(error.code!=='ESRCH')throw Error('Cannot establish that the desktop has exited.');}
   if(live)throw Error('Fully quit ROMDex before exporting so editors and local drafts are checkpointed.');
  }
 }catch(error){if(error.code!=='ENOENT')throw error;}
};
await closed();
const inputs=[],files=[];let total=0;
const add=async(name,relative,required=false)=>{
 const file=path.join(source,relative);let stat;
 try{stat=await fs.lstat(file);}catch(error){if(error.code==='ENOENT'&&!required)return;throw error;}
 if(!stat.isFile()||stat.isSymbolicLink()||!within(source,await fs.realpath(file)))throw Error('Unexpected source file.');
 if(stat.size>64*1024*1024)throw Error('Desktop export exceeds 64 MiB. Source is unchanged.');
 const bytes=await fs.readFile(file);total+=bytes.length;
 if(total>64*1024*1024||files.length>=1000)throw Error('Desktop export exceeds its verified size or file count limit. Source is unchanged.');
 files.push({name,bytes:bytes.length,sha256:hash(bytes),data:bytes.toString('base64')});inputs.push(file);
};
const names=['desktop-workspace.json','assigned-statuses.json','npcdex-current.json','npcdex-recovery-draft.json','journal.json'];
for(const name of names)await add(name,'service/'+name,name==='desktop-workspace.json');
const directory=async(relative,archive,predicate)=>{
 const dir=path.join(source,relative);let stat;
 try{stat=await fs.lstat(dir);}catch(error){if(error.code==='ENOENT')return;throw error;}
 if(!stat.isDirectory()||stat.isSymbolicLink()||!within(source,await fs.realpath(dir)))throw Error('Unexpected desktop export directory.');
 for(const entry of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  if(!entry.isFile()||entry.isSymbolicLink()||!predicate(entry.name))throw Error('Unexpected desktop export directory entry. Keep the full profile backup.');
  await add(archive+'/'+entry.name,relative+'/'+entry.name);
 }
};
for(const folder of ['working','previous','recovery'])await directory('RDX/'+folder,'RDX/'+folder,name=>/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}\.rdx$/.test(name)&&!name.includes('..'));
await directory('service/queued-files/uploads','queued-files/uploads',name=>/^[-\w]{1,100}\.(json|bin)$/.test(name));
for(let index=0;index<files.length;index++)if(hash(await fs.readFile(inputs[index]))!==files[index].sha256)throw Error('The desktop changed during export. Quit ROMDex and retry.');
await closed();
await fs.writeFile(target,JSON.stringify({format:'ROMDexDesktopExport/1',exportedAt:new Date().toISOString(),files}),{flag:'wx'});
const verified=JSON.parse(await fs.readFile(target,'utf8'));
for(const file of verified.files)if(hash(Buffer.from(file.data,'base64'))!==file.sha256)throw Error('Export verification failed; keep the original desktop data.');
console.log(JSON.stringify({export:target,files:files.map(file=>file.name),sourceUnchanged:true,credentialsIncluded:false,pendingRequestsResumed:false,sqliteJournalsIncluded:false}));
