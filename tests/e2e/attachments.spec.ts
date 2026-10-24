import {expect,test,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {structuralFixture,addTask} from './structural-fixture';
test.use({serviceWorkers:'block'});
const content=Buffer.from('ROMDex attachment: durable bytes \u00e9\n');
const attachmentFixture=async(page:Page,mode:'normal'|'lost-upload'|'lost-delete'='normal')=>{
 const s=await structuralFixture(page);await page.getByRole('button',{name:'Fixture Root',exact:true}).last().click();const files=new Map<string,{id:string;name:string;size:number;mimeType:string;created:number;updated:number;author:{id:string};url:string}>();let uploads=0,deletions=0,lost=false;
 await page.route('https://thegobindsingh.youtrack.cloud/api/files/**',async route=>{await route.fulfill({status:200,contentType:'application/octet-stream',body:content,headers:{'access-control-allow-origin':'*'}});});
 await page.route('https://thegobindsingh.youtrack.cloud/api/issues/*/attachments**',async route=>{
  const r=route.request(),u=new URL(r.url()),parts=u.pathname.split('/'),id=parts[3]!,fileId=parts[5],method=r.method(),headers={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,accept,content-type','access-control-allow-methods':'GET, POST, DELETE, OPTIONS'};
  const reply=async(body:unknown,status=200)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(body)});
  if(method==='OPTIONS'){await route.fulfill({status:204,headers});return;}
  expect(id).toMatch(/^PMON-/);
  if(method==='GET'){await reply(fileId?files.get(fileId)??null:[...files.values()],fileId&&!files.has(fileId)?404:200);return;}
  if(method==='POST'){
   expect(r.headers()['content-type']).toContain('multipart/form-data; boundary=');const body=r.postDataBuffer()!;expect(body.includes(content)).toBe(true);expect(body.toString()).toContain('filename="fixture.txt"');
   const key='134-'+(++uploads);files.set(key,{id:key,name:'fixture.txt',size:content.length,mimeType:'text/plain',created:1,updated:1,author:{id:'fixture-owner'},url:'/api/files/'+key});s.tasks.get(id)!.updated++;
   if(mode==='lost-upload'&&!lost){lost=true;await route.abort();return;}await reply([{id:key}]);return;
  }
  if(method==='DELETE'){expect(fileId).toBe('134-1');deletions++;files.delete(fileId!);s.tasks.get(id)!.updated++;if(mode==='lost-delete'&&!lost){lost=true;await route.abort();return;}await route.fulfill({status:204,headers});return;}
  throw Error('Unexpected attachment request '+method+' '+u.pathname);
 });
 const stage=async()=>{await page.getByLabel('Stage a file',{exact:true}).setInputFiles({name:'fixture.txt',mimeType:'text/plain',buffer:content});await expect(page.getByText('File staged in this browser. Save Changes sends it when delivery is connected.',{exact:true})).toBeVisible();};
 return {...s,files,stage,uploads:()=>uploads,deletions:()=>deletions};
};

test('attachments stage offline, survive reload, download exact bytes and delete only after reviewed Save',async({page})=>{
 const s=await attachmentFixture(page);await s.stage();expect(s.uploads()).toBe(0);await page.reload();await expect(page.getByRole('button',{name:'Export Staged fixture.txt',exact:true})).toBeVisible();
 const saved=page.waitForEvent('download');await page.getByRole('button',{name:'Export Staged fixture.txt',exact:true}).click();const local=await saved;expect(await readFile((await local.path())!)).toEqual(content);
 await s.connect();await page.getByRole('button',{name:'Read Attachments',exact:true}).click();await expect(page.getByText('0 attachments read. No file mutation was sent.',{exact:true})).toBeVisible();await s.save();await s.confirmed();expect(s.uploads()).toBe(1);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download fixture.txt',exact:true}).click();expect(await readFile((await (await download).path())!)).toEqual(content);
 await page.getByRole('button',{name:'Remove fixture.txt',exact:true}).click();await page.getByRole('dialog',{name:'Queue deletion of this attachment?',exact:true}).getByRole('button',{name:'Cancel',exact:true}).click();expect(s.deletions()).toBe(0);
 await page.getByRole('button',{name:'Remove fixture.txt',exact:true}).click();await page.getByRole('button',{name:'Queue Attachment Deletion',exact:true}).click();await expect(page.getByText('Attachment deletion queued. Connected Save Changes sends the reviewed request.',{exact:true})).toBeVisible();expect(s.deletions()).toBe(0);await s.save();await s.confirmed();expect(s.deletions()).toBe(1);await page.reload();await expect(page.getByRole('button',{name:'Download fixture.txt',exact:true})).toHaveCount(0);
});

test('lost upload requires an exact receipt and byte readback after restart without resending',async({page})=>{
 const s=await attachmentFixture(page,'lost-upload');await s.stage();await s.connect();await s.save();await s.uncertain();expect(s.uploads()).toBe(1);await page.reload();await s.connect();await page.getByRole('button',{name:'Connection Details',exact:true}).click();await page.getByRole('button',{name:'Read Current Attachment IDs',exact:true}).click();await expect(page.getByText('Current attachment IDs read. No upload or deletion was resent.',{exact:true})).toBeVisible();await page.getByLabel('Exact attachment ID, if needed',{exact:true}).fill('134-1');await page.getByRole('button',{name:'Read back and confirm; do not resend',exact:true}).click();await expect(page.getByRole('heading',{name:'Uncertain delivery',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Close Connection Details',exact:true}).click();await s.save();await s.confirmed();expect(s.uploads()).toBe(1);
});

test('a file queued for a newly created task follows the exact returned PMON identity',async({page})=>{
 const s=await attachmentFixture(page);await addTask(page,'Task with file');await s.stage();await s.connect();await s.save();await s.confirmed();expect(s.tasks.get('PMON-900101')?.summary).toBe('Task with file');expect(s.uploads()).toBe(1);await expect(page.getByRole('button',{name:'Download fixture.txt',exact:true})).toBeVisible();
});

test('oversized file selection shows the actual tenant limit without queuing or uploading',async({page})=>{
 const s=await attachmentFixture(page);await page.getByLabel('Stage a file',{exact:true}).setInputFiles({name:'too-large.bin',mimeType:'application/octet-stream',buffer:Buffer.alloc(10*1024*1024+1)});await expect(page.getByText('YouTrack accepts files up to 10 MiB. No upload was sent. Keep the original file.',{exact:true})).toBeVisible();expect(s.uploads()).toBe(0);await expect(page.getByRole('button',{name:/^Export Staged/})).toHaveCount(0);
});

test('lost deletion stays blocked until exact missing-file acknowledgement, without a second DELETE',async({page})=>{
 const s=await attachmentFixture(page,'lost-delete');await s.stage();await s.connect();await s.save();await s.confirmed();
 await page.getByRole('button',{name:'Remove fixture.txt',exact:true}).click();await page.getByRole('button',{name:'Queue Attachment Deletion',exact:true}).click();await s.save();await s.uncertain();expect(s.deletions()).toBe(1);
 await page.reload();await s.connect();await page.getByRole('button',{name:'Connection Details',exact:true}).click();const confirm=page.getByRole('button',{name:'Read back and confirm; do not resend',exact:true});await expect(confirm).toBeDisabled();await page.getByRole('button',{name:'Read Current Attachment IDs',exact:true}).click();await expect(page.getByText('Current attachment IDs read. No upload or deletion was resent.',{exact:true})).toBeVisible();await page.getByRole('checkbox',{name:/I checked 134-1 in YouTrack/}).check();await confirm.click();await expect(page.getByRole('heading',{name:'Uncertain delivery',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Close Connection Details',exact:true}).click();await s.save();await s.confirmed();expect(s.deletions()).toBe(1);
});

test('changed deletion metadata selects the conflict message and sends no DELETE',async({page})=>{
 const s=await attachmentFixture(page);await s.stage();await s.connect();await s.save();await s.confirmed();await page.getByRole('button',{name:'Remove fixture.txt',exact:true}).click();await page.getByRole('button',{name:'Queue Attachment Deletion',exact:true}).click();s.files.get('134-1')!.updated++;
 await s.save();await expect(page.getByText('Review the changed attachment. No deletion was sent.',{exact:true})).toBeVisible();expect(s.deletions()).toBe(0);await page.getByRole('button',{name:'Connection Details',exact:true}).click();await expect(page.getByRole('heading',{name:'Conflicting edits',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Read back and confirm; do not resend',exact:true})).toBeDisabled();
});

test('recovery imports exact staged bytes into a separate browser workspace with delivery disconnected',async({page,browser,baseURL})=>{
 const s=await attachmentFixture(page);await s.stage();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export Recovery Copy',exact:true}).click();const bytes=await readFile((await (await pending).path())!);const root=JSON.parse(bytes.toString());expect(Buffer.from(root.uploads[0].data,'base64')).toEqual(content);
 const context=await browser.newContext({baseURL});try{const other=await context.newPage();let requests=0;await other.route('https://thegobindsingh.youtrack.cloud/**',async route=>{requests++;await route.abort();});await other.goto('/');await other.getByRole('button',{name:'Import Desktop or Recovery Data',exact:true}).click();await other.getByLabel('Export or recovery JSON',{exact:true}).setInputFiles({name:'recovery.json',mimeType:'application/json',buffer:bytes});await expect(other.getByText('File verified locally. No cloud request was made.',{exact:true})).toBeVisible();await other.getByRole('checkbox',{name:/I have preserved my current recovery copy/}).check();await other.getByRole('button',{name:'Import Reviewed Data',exact:true}).click();await expect(other.getByRole('dialog',{name:'Import Desktop or Recovery Data',exact:true})).toHaveCount(0);await other.reload();const local=other.waitForEvent('download');await other.getByRole('button',{name:'Export Staged fixture.txt',exact:true}).click();expect(await readFile((await (await local).path())!)).toEqual(content);await other.getByRole('button',{name:/^Save Changes/}).click();expect(requests).toBe(0);expect(s.uploads()).toBe(0);}finally{await context.close();}
});
