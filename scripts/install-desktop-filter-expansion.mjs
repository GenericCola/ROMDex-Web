import {readFile,writeFile,mkdir,copyFile,cp,mkdtemp,readdir,stat,unlink} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {homedir,tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const repo=resolve(import.meta.dirname,'..'),base=join(homedir(),'AppData/Local/ROMDexDesktop'),target=join(base,'app-0.5.15/resources/app/public'),data=join(base,'Data');
const manifest=JSON.parse(await readFile(join(repo,'patches/desktop-filter-expansion.json'),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const digest=async file=>existsSync(file)?hash(await readFile(file)):null;
function exited(){const result=spawnSync('powershell.exe',['-NoProfile','-Command',"@(Get-Process -Name ROMDex -ErrorAction SilentlyContinue).Count"],{encoding:'utf8',windowsHide:true});if(result.status!==0||result.stdout.trim()!=='0')throw Error('Quit ROMDex through its tray menu before installing.');}
async function inventory(root,relative=''){const rows={};for(const entry of await readdir(join(root,relative),{withFileTypes:true})){const child=join(relative,entry.name);if(entry.isSymbolicLink())throw Error('Unexpected linked profile path.');if(entry.isDirectory())Object.assign(rows,await inventory(root,child));else rows[child]=await digest(join(root,child));}return rows;}
if(process.argv.includes('--install'))exited();
for(const [name,expected] of Object.entries(manifest.files))if(await digest(join(target,name))!==expected.before)throw Error('Desktop baseline changed: '+name+'. Nothing installed.');
const stage=await mkdtemp(join(tmpdir(),'romdex-filter-expansion-'));
for(const [name,expected] of Object.entries(manifest.files))if(expected.before)await copyFile(join(target,name),join(stage,name));
const applied=spawnSync('git',['apply','--unidiff-zero','--',join(repo,'patches/desktop-filter-expansion.patch')],{cwd:stage,encoding:'utf8',windowsHide:true});if(applied.status!==0)throw Error('Could not prepare desktop patch: '+applied.stderr);
for(const [name,expected] of Object.entries(manifest.files)){if(expected.before)await writeFile(join(stage,name),(await readFile(join(stage,name),'utf8')).replaceAll('\r\n','\n'));if(!expected.before)await copyFile(join(repo,'patches/desktop-task-filters',name),join(stage,name));if(await digest(join(stage,name))!==expected.after)throw Error('Candidate hash mismatch: '+name);}
await writeFile(join(repo,'artifacts/desktop-filter-expansion/preparation.json'),JSON.stringify({stage,verified:Object.keys(manifest.files)},null,2));
if(!process.argv.includes('--install')){console.log('Prepared and hash-verified one source file. Installed app unchanged.');process.exit(0);}
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),backup=join(base,'Backups','filter-expansion-'+stamp);
await mkdir(join(backup,'public'),{recursive:true});const before=await inventory(data);await cp(data,join(backup,'Data'),{recursive:true,errorOnExist:true,force:false});
if(JSON.stringify(before)!==JSON.stringify(await inventory(join(backup,'Data'))))throw Error('Profile backup mismatch. Nothing installed.');
for(const [name,expected] of Object.entries(manifest.files))if(expected.before)await copyFile(join(target,name),join(backup,'public',name));
exited();
for(const [name,expected] of Object.entries(manifest.files))if(await digest(join(target,name))!==expected.before)throw Error('Desktop changed during backup. Nothing installed.');
const order=['work-view.mjs'];
try{for(const name of order)await copyFile(join(stage,name),join(target,name));for(const [name,expected] of Object.entries(manifest.files))if(await digest(join(target,name))!==expected.after)throw Error('Installed hash mismatch.');if(JSON.stringify(before)!==JSON.stringify(await inventory(data)))throw Error('Profile changed during install.');}
catch(error){for(const [name,expected] of Object.entries(manifest.files)){if(expected.before)await copyFile(join(backup,'public',name),join(target,name));else if(existsSync(join(target,name)))await unlink(join(target,name));}throw error;}
const evidence={installedAt:new Date().toISOString(),backup,sourceFiles:manifest.files,profileFileCount:Object.keys(before).length,backupVerified:true,profileUnchanged:true};await writeFile(join(backup,'installation.json'),JSON.stringify(evidence,null,2));await writeFile(join(repo,'artifacts/desktop-filter-expansion/installation.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({installed:true,backup,profileFileCount:evidence.profileFileCount,profileUnchanged:true}));
