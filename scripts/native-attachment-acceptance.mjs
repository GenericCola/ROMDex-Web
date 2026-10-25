// Explicit manual acceptance only. Never imported by application or default suites.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium, firefox, expect as baseExpect } from '@playwright/test';
import { createGuard, tenant, fixtures, recoverySpec, validateRecovery } from './native-attachment-guard.mjs';
const origin = 'https://romdex-web.vercel.app';
const source = '36e748eaad7e360974c62c392a61c639ae19f804';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
let browser, context, page, guard, output, recoveryPath;
let phase = 'arguments';
const evidence = { source, syntheticTaskContext: false, nativeAcceptance: 'UNRUN', messages: [], receipts: [], phases: [] };
const started=Date.now();
const mark=name=>{phase=name;evidence.phases.push({phase:name,elapsedMs:Date.now()-started});};
const main = async () => {
  assert.ok(!process.env.DEBUG && !process.env.PWDEBUG && !process.env.NODE_DEBUG);
  const args = process.argv.slice(2);
  assert.ok(args.length===8 || args.length===10);
  const options = {};
  for(let i=0;i<args.length;i+=2) { assert.ok(['--browser','--fixture','--run','--output','--recovery'].includes(args[i]) && !(args[i] in options)); options[args[i]]=args[i+1]; }
  const recovery=!!options['--recovery'];
  const expect=baseExpect.configure({timeout:30000});
  let recoveryBytes;
  if(recovery) {
    recoveryPath=resolve(options['--recovery']);
    assert.equal(recoveryPath,resolve('artifacts/native-attachments-2026-10-25/firefox-20261025-b/stopped-recovery.json'));
    recoveryBytes=await readFile(recoveryPath);validateRecovery(recoveryBytes);evidence.inputRecoveryHash=hash(recoveryBytes);
    assert.equal(process.env.PLAYWRIGHT_BROWSERS_PATH,resolve('.playwright-browsers'));
  }
  guard = createGuard({browser:options['--browser'],fixture:options['--fixture'],run:options['--run'],recovery});
  evidence.recoveryOnly=recovery;
  const proposedOutput=resolve(options['--output']); await mkdir(proposedOutput); output=proposedOutput; // Existing evidence directories are never overwritten.
  Object.assign(evidence,{browser:options['--browser'],fixture:options['--fixture'],run:options['--run'],file:guard.name,sha256:hash(guard.bytes)});
  await writeFile(join(output,guard.name),guard.bytes,{flag:'wx'});
  mark('stdin');
  let token='';
  for await(const chunk of process.stdin) { token+=chunk.toString(); assert.ok(token.length<=8192); }
  token=token.trim(); assert.ok(token && !/[\r\n]/.test(token));
  mark('launch');
  browser=await ({chromium,firefox}[options['--browser']]).launch({headless:true,...(options['--browser']==='chromium'?{channel:'chrome'}:{})});
  evidence.browserVersion=browser.version();evidence.browserChannel=options['--browser']==='chromium'?'installed Chrome':'Playwright Firefox; OS installation not tested';
  context=await browser.newContext({serviceWorkers:'block',acceptDownloads:true});
  page=await context.newPage(); page.setDefaultTimeout(30000);
  const routes=new Map();
  await context.exposeBinding('__nativeAttachmentObserved',async (_,{url,method,status,value,type})=>{
    try {
      const allowed=routes.get(method+' '+url); assert.ok(allowed); const {kind}=allowed; assert.equal(type,'cors');
      evidence.receipts.push({kind,method,status,cors:type,path:kind==='file'?'[exact registered file address]':new URL(url).pathname});
      guard.observe({...allowed,status,value});
      Object.assign(evidence.receipts.at(-1),{...(kind==='post'?{id:guard.state.receipt}:{}),...(kind==='tasks'?{taskIds:value.map(task=>task.idReadable)}:{}),...(kind==='account'?{accountId:guard.state.account}:{}),...(kind==='metadata'?{metadata:{id:value.id,name:value.name,size:value.size,mimeType:value.mimeType,created:value.created,updated:value.updated,authorId:value.author.id}}:{})});
    } catch { guard.halt(); throw Error('Native acceptance stopped.'); }
  });
  // Wait for native metadata registration before returning the original Response to the app.
  // No response is substituted; browser fetch must pass actual origin CORS first.
  await context.addInitScript(({tenant})=>{
    const original=window.fetch.bind(window);
    window.fetch=async(input,init)=>{
      const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,location.href);
      const method=init?.method||'GET';
      let response;
      try { response=await original(input,url.origin===tenant?{...init,redirect:'error',credentials:'omit'}:init); } catch { throw Error('Native request failed; acceptance stopped.'); }
      if(url.origin===tenant) {
        const value=method==='DELETE'||/^\/(?:youtrack\/)?api\/files\//.test(url.pathname)?null:await response.clone().json();
        await window.__nativeAttachmentObserved({url:url.href,method,status:response.status,value,type:response.type});
      }
      return response;
    };
  },{tenant});
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url()),method=request.method();
    try {
      assert.ok(!guard.state.halted && !request.redirectedFrom());
      if(url.origin===origin && method==='GET') { await route.continue(); return; }
      assert.equal(url.origin,tenant);
      const allowed=guard.authorize({url:url.href,method,contentType:request.headers()['content-type']||'',body:request.postDataBuffer(),redirected:!!request.redirectedFrom()});
      routes.set(method+' '+url.href,allowed);
      await route.continue({url:allowed.url});
    } catch { guard.halt(); evidence.guardRefused=true; await route.abort('blockedbyclient'); }
  });
  const button=name=>page.getByRole('button',{name,exact:true});
  const message=async text=>{await expect(page.getByText(text,{exact:true})).toBeVisible();assert.ok(!guard.state.halted);evidence.messages.push(text);};
  const download=async(label,destination)=>{const pending=page.waitForEvent('download');pending.catch(()=>{});await button(label).click();const item=await pending;await item.saveAs(join(output,destination));return readFile(join(output,destination));};
  const screenshot=async name=>{for(const label of ['YouTrack Permanent Token','Session token for delivery']) {const field=page.getByLabel(label,{exact:true});if(await field.count())await field.fill('');}await page.screenshot({path:join(output,name),fullPage:true});};
  if(recovery) {
    mark('import exact recovery');await page.goto(origin);
    await button('Import Desktop or Recovery Data').click();
    await page.getByLabel('Export or recovery JSON',{exact:true}).setInputFiles({name:'stopped-recovery.json',mimeType:'application/json',buffer:recoveryBytes});
    await message('File verified locally. No cloud request was made.');
    await page.getByRole('checkbox',{name:/I have preserved my current recovery copy/}).check();await button('Import Reviewed Data').click();
    await expect(page.getByRole('dialog',{name:'Import Desktop or Recovery Data',exact:true})).toHaveCount(0);
    await expect(page.getByRole('switch',{name:'Auto-Sync Data',exact:true})).not.toBeChecked();
    await button('Connection Details').click();await expect(button('Disconnect delivery')).toBeDisabled();
    await expect(page.getByRole('heading',{name:'Uncertain delivery',exact:true})).toBeVisible();
    await screenshot('imported-uncertain.png');await button('Close Connection Details').click();
    assert.equal(guard.state.posts,0);assert.equal(guard.state.deletes,0);
  } else {
  mark('native quarantine task read');await page.goto(origin);await expect(page.getByRole('switch',{name:'Auto-Sync Data',exact:true})).not.toBeChecked();await button('Connection Details').click();
  await page.getByLabel('YouTrack Permanent Token',{exact:true}).fill(token);await button('Read YouTrack Tasks').click();await message('3 tasks read. Review before saving a browser copy.');await expect(page.getByLabel('YouTrack Permanent Token',{exact:true})).toHaveValue('');await button('Save 3 Tasks in This Browser').click();
  await expect(page.getByRole('dialog',{name:'Connection Details',exact:true})).toHaveCount(0);await button('Expand All').click();await button(fixtures[options['--fixture']].title).last().click();await expect(page.getByLabel('Stage a file',{exact:true})).toBeVisible();
  mark('disconnected stage');await page.getByLabel('Stage a file',{exact:true}).setInputFiles({name:guard.name,mimeType:'text/plain',buffer:guard.bytes});
  await message('File staged in this browser. Save Changes sends it when delivery is connected.');assert.equal(guard.state.posts,0);
  await page.reload();await expect(button('Export Staged '+guard.name)).toBeVisible();
  assert.deepEqual(await download('Export Staged '+guard.name,'staged-export.txt'),guard.bytes);
  await message('Staged bytes exported. No cloud request was made.');
  const recovery=await download('Export Recovery Copy','before-delivery-recovery.json');
  assert.ok(!recovery.includes(Buffer.from(token)));assert.deepEqual(Buffer.from(JSON.parse(recovery).uploads[0].data,'base64'),guard.bytes);
  }
  mark('connect');await button('Connection Details').click();await page.getByLabel('Session token for delivery',{exact:true}).fill(token);await button('Enable delivery for this session').click();
  await message('Saved. Use Save Changes to run one delivery cycle.');await expect(page.getByLabel('Session token for delivery',{exact:true})).toHaveValue('');await button('Close Connection Details').click();
  if(recovery) {
    mark('readback without resend');await button('Connection Details').click();
    await expect(page.getByRole('heading',{name:'Uncertain delivery',exact:true})).toBeVisible();
    await button('Read Current Attachment IDs').click();await message('Current attachment IDs read. No upload or deletion was resent.');
    await page.getByLabel('Exact attachment ID, if needed',{exact:true}).fill(recoverySpec.receipt);
    await button('Read back and confirm; do not resend').click();
    await expect(page.getByRole('heading',{name:'Uncertain delivery',exact:true})).toHaveCount(0);
    await button('Close Connection Details').click();
    const confirmed=JSON.parse((await download('Export Recovery Copy','readback-confirmed-recovery.json')).toString());
    assert.equal(confirmed.data.operations.length,0);assert.equal(confirmed.data.cloud.records[recoverySpec.opId].status,'confirmed');assert.equal(confirmed.data.cloud.records[recoverySpec.opId].remoteId,recoverySpec.receipt);assert.equal(confirmed.data.cloud.records[recoverySpec.opId].message,'Exact attachment ID and bytes confirmed without resending.');
    assert.equal(guard.state.posts,0);assert.equal(guard.state.deletes,0);evidence.readbackConfirmed=true;
  } else {
  mark('empty baseline');await button('Read Attachments').click();await message('0 attachments read. No file mutation was sent.');assert.equal(guard.state.baseline,true);
  mark('upload');await page.getByRole('button',{name:/^Save Changes/}).click();await message('Queued supported changes confirmed by YouTrack. Auto-Sync preference unchanged.');assert.equal(guard.state.posts,1);
  }
  mark('download');assert.deepEqual(await download('Download '+guard.name,'native-download.txt'),guard.bytes);await message('Attachment downloaded from verified current metadata.');
  assert.ok(evidence.receipts.filter(receipt=>receipt.kind==='file' && receipt.cors==='cors' && receipt.status>=200 && receipt.status<300).length>=2);
  if(recovery)guard.state.bytesVerified=true;
  evidence.attachmentId=guard.state.receipt;await screenshot('uploaded.png');
  mark('cancel deletion');await button('Remove '+guard.name).click();const dialog=page.getByRole('dialog',{name:'Queue deletion of this attachment?',exact:true});
  await expect(dialog).toContainText(guard.state.receipt);await expect(dialog).toContainText(guard.name);await expect(dialog).toContainText(options['--fixture']);await expect(dialog).toContainText(guard.bytes.length+' bytes');await expect(dialog).toContainText('permanently deletes');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(guard.state.deletes,0);
  mark('review deletion');await button('Remove '+guard.name).click();await expect(dialog).toContainText(guard.state.receipt);await button('Queue Attachment Deletion').click();
  await message('Attachment deletion queued. Connected Save Changes sends the reviewed request.');assert.equal(guard.state.deletes,0);guard.armDelete(guard.state.receipt);
  mark('delete');await page.getByRole('button',{name:/^Save Changes/}).click();await expect.poll(()=>guard.state.deletedInventory).toBe(true);await message('Queued supported changes confirmed by YouTrack. Auto-Sync preference unchanged.');assert.equal(guard.state.deletes,1);
  mark('disconnect');await button('Connection Details').click();await button('Disconnect delivery').click();await message('Disconnected. Queue and drafts kept; session token discarded.');await button('Close Connection Details').click();
  await page.reload();await expect(page.getByRole('switch',{name:'Auto-Sync Data',exact:true})).not.toBeChecked();await expect(button('Download '+guard.name)).toHaveCount(0);await screenshot('deleted-reloaded.png');
  const finalRecovery=JSON.parse((await download('Export Recovery Copy','final-recovery.json')).toString());
  if(recovery){assert.equal(finalRecovery.data.operations.length,0);assert.equal(guard.state.posts,0);assert.equal(hash(await readFile(recoveryPath)),recoverySpec.inputHash);evidence.inputRecoveryHashAfter=recoverySpec.inputHash;}
  evidence.nativeAcceptance='PASS attachment transport only; MCP preservation readback pending';
  token='';
};
try { await main(); }
catch {
  guard?.halt(); evidence.nativeAcceptance='STOPPED'; evidence.stoppedAt=phase; process.exitCode=1;
  // Do not print Playwright errors: call logs can contain password values or signed URLs.
  if(page && output) {
    try {for(const label of ['YouTrack Permanent Token','Session token for delivery']) {const input=page.getByLabel(label,{exact:true});if(await input.count())await input.fill('');}await page.screenshot({path:join(output,'stopped.png'),fullPage:true});}catch{}
    try {const close=page.getByRole('button',{name:'Close Connection Details',exact:true});if(await close.isVisible())await close.click();const pending=page.waitForEvent('download',{timeout:5000});pending.catch(()=>{});await page.getByRole('button',{name:'Export Recovery Copy',exact:true}).click();await (await pending).saveAs(join(output,'stopped-recovery.json'));}catch{}
  }
}
finally {
  if(recoveryPath) {try {evidence.inputRecoveryHashAfter=hash(await readFile(recoveryPath));if(evidence.inputRecoveryHashAfter!==recoverySpec.inputHash){evidence.nativeAcceptance='STOPPED';process.exitCode=1;}}catch{evidence.nativeAcceptance='STOPPED';process.exitCode=1;}}
  evidence.elapsedMs=Date.now()-started;
  if(output)await writeFile(join(output,'result.json'),JSON.stringify(evidence,null,2));
  await context?.close().catch(()=>{});await browser?.close().catch(()=>{});
  process.stdout.write(JSON.stringify({result:evidence.nativeAcceptance,phase})+'\n');
}










