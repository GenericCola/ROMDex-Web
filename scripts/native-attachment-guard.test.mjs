import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGuard,tenant,fixtures,metadataFields,taskFields,detailFields,fixtureQuery,recoverySpec,validateRecovery} from './native-attachment-guard.mjs';
const make=()=>createGuard({browser:'chromium',fixture:'PMON-467',run:'offline'});
const list={url:`${tenant}/api/issues/PMON-467/attachments?fields=${metadataFields}&$top=100&$skip=0`,method:'GET'};
const taskRows=()=>Object.entries(fixtures).map(([id,f])=>({idReadable:id,summary:f.title,project:{shortName:'PMON'},parent:{issues:f.parent?[{idReadable:f.parent}]:[]}}));
const taskList={url:tenant+'/api/issues?'+new URLSearchParams({fields:taskFields,query:'project: PMON sort by: created asc','$top':'100','$skip':'0'}),method:'GET'};
const ready=()=>{const g=make();g.observe({kind:'tasks',skip:0,status:200,value:taskRows()});g.authorize(list);g.observe({kind:'inventory',status:200,value:[]});g.observe({kind:'account',status:200,value:{id:'1-1'}});return g;};
const post=g=>({url:`${tenant}/api/issues/PMON-467/attachments?fields=id`,method:'POST',contentType:'multipart/form-data; boundary=abc',body:Buffer.concat([Buffer.from(`--abc\r\nContent-Disposition: form-data; name="upload"; filename="${g.name}"\r\nContent-Type: text/plain\r\n\r\n`),g.bytes,Buffer.from('\r\n--abc--\r\n')])});
let count=0;
const test=(name,fn)=>{fn();count++;};
const refuses=(request,setup=ready)=>{const g=setup();assert.throws(()=>g.authorize(typeof request==='function'?request(g):request));assert.equal(g.state.halted,true);};
test('fixture/browser allowlist',()=>{assert.throws(()=>createGuard({browser:'chromium',fixture:'PMON-468',run:'x'}));assert.throws(()=>createGuard({browser:'firefox',fixture:'PMON-1',run:'x'}));assert.throws(()=>createGuard({browser:'chromium',fixture:'PMON-467',run:'../x'}));});
test('attachment URL unchanged',()=>assert.equal(make().authorize(list).url,new URL(list.url).href));
for(const request of [
 {...list,url:list.url.replace('PMON-467','PMON-1')}, {...list,url:list.url.replace('PMON-467','NPCD-872')},
 {...list,url:list.url.replace(tenant,'https://evil.invalid')}, {...list,url:list.url+'&extra=1'},
 {...list,url:list.url+'&fields=id'}, {...list,method:'PATCH'}, {...list,method:'OPTIONS'}, {...list,redirected:true},
 {url:tenant+'/api/issues/'+'PMON-467',method:'POST'}, {url:tenant+'/api/files/unregistered?signature=secret',method:'GET'},
 {url:tenant+'/api/users/me?fields=id,login',method:'GET'},
 {url:tenant+'/api/issues/'+'PMON-467'+'/attachments/134-9',method:'DELETE'}
])test('refuse unsafe route/method',()=>refuses(request));
test('baseline required',()=>refuses(post,make));
test('nonempty baseline stops',()=>assert.throws(()=>make().observe({kind:'inventory',status:200,value:[{id:'old'}]})));
test('HTTP failure stops',()=>assert.throws(()=>make().observe({kind:'inventory',status:401,value:[]})));
for(const mutate of [p=>({...p,body:null}),p=>({...p,body:Buffer.concat([p.body,Buffer.from('extra')])}),p=>({...p,body:Buffer.from(p.body.toString().replace('filename="romdex','filename="other'))}),p=>({...p,body:Buffer.from(p.body.toString().replace('acceptance','wrong'))}),p=>({...p,contentType:'application/json'})])test('exact multipart refused',()=>refuses(g=>mutate(post(g))));
test('one post only',()=>{const g=ready();g.authorize(post(g));assert.throws(()=>g.authorize(post(g)));});
test('receipt and reviewed deletion only',()=>{const g=ready();g.authorize(post(g));g.observe({kind:'post',status:200,value:[{id:'134-1'}]});assert.throws(()=>g.authorize({url:tenant+'/api/issues/'+'PMON-467'+'/attachments/134-1',method:'DELETE'}));});
test('successful exact sequence and no second delete',()=>{const g=ready();g.authorize(post(g));g.observe({kind:'post',status:200,value:[{id:'134-1'}]});const value={id:'134-1',name:g.name,size:g.bytes.length,author:{id:'1-1'},url:'/api/files/exact?signature=opaque'};g.observe({kind:'inventory',status:200,value:[value]});g.observe({kind:'metadata',status:200,value});assert.equal(g.authorize({url:tenant+value.url,method:'GET'}).kind,'file');g.armDelete('134-1');g.authorize({url:tenant+'/api/issues/'+'PMON-467'+'/attachments/134-1',method:'DELETE'});g.observe({kind:'inventory',status:200,value:[]});assert.throws(()=>g.authorize({url:tenant+'/api/issues/'+'PMON-467'+'/attachments/134-1',method:'DELETE'}));});
test('registered signed URL exact match',()=>{const g=ready();g.authorize(post(g));g.observe({kind:'post',status:200,value:[{id:'134-1'}]});g.observe({kind:'metadata',status:200,value:{id:'134-1',name:g.name,size:g.bytes.length,author:{id:'1-1'},url:'/api/files/exact?signature=opaque'}});assert.throws(()=>g.authorize({url:tenant+'/api/files/exact?signature=changed',method:'GET'}));});
test('invalid receipt ID',()=>{const g=ready();g.authorize(post(g));assert.throws(()=>g.observe({kind:'post',status:200,value:[{id:'../old'}]}));});
test('old deletion cannot arm',()=>{const g=ready();g.authorize(post(g));g.observe({kind:'post',status:200,value:[{id:'134-1'}]});assert.throws(()=>g.armDelete('134-2'));});
test('foreign file URL refused',()=>{const g=ready();g.authorize(post(g));g.observe({kind:'post',status:200,value:[{id:'134-1'}]});assert.throws(()=>g.observe({kind:'metadata',status:200,value:{id:'134-1',name:g.name,size:g.bytes.length,author:{id:'1-1'},url:'https://evil.invalid/api/files/x'}}));});
test('task query narrowed and remaining params retained',()=>{const result=make().authorize(taskList);const before=new URL(taskList.url),after=new URL(result.url);assert.equal(after.searchParams.get('query'),fixtureQuery);for(const key of ['fields','$top','$skip'])assert.equal(after.searchParams.get(key),before.searchParams.get(key));});
test('list pagination preserved',()=>{const request={...taskList,url:taskList.url.replace('%24skip=0','%24skip=100')};assert.equal(new URL(make().authorize(request).url).searchParams.get('$skip'),'100');});
test('unknown list query denied',()=>refuses({...taskList,url:taskList.url.replace('created','updated')}));
test('nonallowlisted detail denied',()=>refuses({url:tenant+'/api/issues/PMON-1?fields='+encodeURIComponent(detailFields),method:'GET'}));
test('exact detail allowed',()=>assert.equal(make().authorize({url:tenant+'/api/issues/PMON-468?fields='+encodeURIComponent(detailFields),method:'GET'}).taskId,'PMON-468'));
for(const change of [rows=>rows[0].idReadable='PMON-1',rows=>rows[1].project.shortName='NPCD',rows=>rows[1].summary='Wrong',rows=>rows[1].parent.issues=[],rows=>rows.push(rows[0]),rows=>rows.pop()])test('unexpected native task identity refused',()=>{const g=make(),rows=taskRows();change(rows);assert.throws(()=>g.observe({kind:'tasks',skip:0,status:200,value:rows}));assert.equal(g.state.halted,true);});
test('wrong requested detail refused',()=>assert.throws(()=>make().observe({kind:'task',taskId:'PMON-468',status:200,value:taskRows()[1]})));
test('sibling attachment access refused',()=>refuses({...list,url:list.url.replace('PMON-467','PMON-468')}));
test('Epic attachment access refused',()=>refuses({...list,url:list.url.replace('PMON-467','PMON-466')}));
test('empty later page does not establish identity baseline',()=>{const g=make();g.observe({kind:'tasks',skip:100,status:200,value:[]});assert.notEqual(g.state.tasksVerified,true);});
const recoveryBytes=readFileSync('artifacts/native-attachments-2026-10-25/firefox-20261025-b/stopped-recovery.json');
const recover=()=>createGuard({browser:'firefox',fixture:'PMON-468',run:'recovery-test',recovery:true});
const recoveryFile={id:'12-3400',name:recoverySpec.file.name,size:64,mimeType:'text/plain',author:{id:'2-2'},created:1792950796859,updated:1792950796817,url:'/api/files/exact?signature=opaque'};
test('exact recovery accepted',()=>assert.equal(validateRecovery(recoveryBytes).data.operations[0].opId,recoverySpec.opId));
test('any input byte change refused',()=>assert.throws(()=>validateRecovery(Buffer.concat([recoveryBytes,Buffer.from(' ')]))));
test('wrong recovery fixture refused',()=>assert.throws(()=>createGuard({browser:'chromium',fixture:'PMON-467',run:'x',recovery:true})));
for(const path of ['/api/issues/PMON-468/attachments?fields=id','/api/issues/PMON-468','/api/issues/PMON-467/attachments','/api/issues/PMON-468/extensionEndpoints/x'])test('recovery POST always denied',()=>{const g=recover();assert.throws(()=>g.authorize({url:tenant+path,method:'POST'}));assert.equal(g.state.posts,0);assert.equal(g.state.halted,true);});
test('recovery wrong account refused',()=>assert.throws(()=>recover().observe({kind:'account',status:200,value:{id:'other'}})));
test('recovery wrong receipt refused',()=>{const g=recover();g.observe({kind:'account',status:200,value:{id:'2-2'}});assert.throws(()=>g.observe({kind:'inventory',status:200,value:[{...recoveryFile,id:'12-3401'}]}));});
test('recovery delete before byte review refused',()=>assert.throws(()=>recover().armDelete('12-3400')));
test('recovery unrelated delete refused',()=>assert.throws(()=>recover().authorize({url:tenant+'/api/issues/PMON-468/attachments/12-3399',method:'DELETE'})));
test('recovery metadata mutation refused',()=>{const g=recover();g.observe({kind:'account',status:200,value:{id:'2-2'}});assert.throws(()=>g.observe({kind:'metadata',status:200,value:{...recoveryFile,updated:1}}));});
test('recovery exact readback and reviewed deletion',()=>{const g=recover();g.observe({kind:'account',status:200,value:{id:'2-2'}});g.observe({kind:'inventory',status:200,value:[recoveryFile]});g.observe({kind:'metadata',status:200,value:recoveryFile});g.state.bytesVerified=true;g.armDelete('12-3400');g.authorize({url:tenant+'/api/issues/PMON-468/attachments/12-3400',method:'DELETE'});assert.equal(g.state.posts,0);assert.equal(g.state.deletes,1);g.observe({kind:'inventory',status:200,value:[]});assert.equal(g.state.deletedInventory,true);assert.throws(()=>g.authorize({url:tenant+'/api/issues/PMON-468/attachments/12-3400',method:'DELETE'}));});
console.log(`${count} offline guard assertions passed; no browser or network executed.`);




