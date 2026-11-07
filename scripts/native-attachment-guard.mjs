import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const recoverySpec = Object.freeze({
  inputHash:'79ef8657d53d40be96fe8e213711c6fe99c6f35cddf8ca7d74891df6a66f7099',
  opId:'fb03c726-31c5-41c2-8018-3749640baf6d', receipt:'12-3400', account:'2-2',
  run:'firefox-20261025-b', fixture:'PMON-468',
  file:{name:'romdex-native-pmon-468-firefox-20261025-b.txt',size:64,mimeType:'text/plain',hash:'96b32b2ba21f7d946c18a2ad76262ab63bb2b45e8aaa78961f033835bd10f8b6'},
});
export const validateRecovery = bytes => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'),recoverySpec.inputHash);
  const root=JSON.parse(bytes.toString()),data=root.data,s=recoverySpec;
  assert.equal(root.format,'ROMDexWebRecovery/1');assert.equal(data.operations.length,1);assert.equal(root.uploads.length,1);assert.deepEqual(root.missingUploads,[]);
  const op=data.operations[0],upload=root.uploads[0],record=data.cloud.records[s.opId];
  assert.deepEqual(op,{opId:s.opId,type:'attachment',issueId:s.fixture,uploadId:s.opId,file:s.file});
  assert.equal(upload.id,s.opId);assert.deepEqual(upload.file,s.file);
  const payload=Buffer.from(upload.data,'base64');assert.equal(payload.length,s.file.size);assert.equal(createHash('sha256').update(payload).digest('hex'),s.file.hash);
  assert.deepEqual(Object.keys(data.cloud.records),[s.opId]);assert.equal(record.status,'uncertain');assert.equal(record.remoteId,s.receipt);assert.equal(record.targetId,s.fixture);assert.deepEqual(record.attachmentBeforeIds,[]);
  assert.equal(data.cloud.accountId,s.account);assert.equal(data.cloud.autoSync,false);assert.ok(!data.cloud.rollupPending);assert.equal(data.newTask,null);
  assert.deepEqual(data.titleDrafts,{});assert.deepEqual(data.commentDrafts,{});assert.deepEqual(data.editorRecovery,[]);
  assert.equal(data.remote.length,3);assert.equal(new Set(data.remote.map(task=>task.id)).size,3);
  for(const task of data.remote) {assert.ok(Object.hasOwn(fixtures,task.id));assert.equal(task.summary,fixtures[task.id].title);assert.equal(task.parentId,fixtures[task.id].parent);}
  return root;
};
export const tenant = 'https://thegobindsingh.youtrack.cloud';
export const fixtures = {
  'PMON-466': {title:'[ROMDex TEST ONLY] Quarantined web migration acceptance',parent:null},
  'PMON-467': {title:'[ROMDex TEST ONLY] Chrome attachment acceptance',parent:'PMON-466'},
  'PMON-468': {title:'[ROMDex TEST ONLY] Firefox attachment acceptance',parent:'PMON-466'},
};
export const taskFields = 'id,idReadable,summary,description,updated,project(shortName),parent(issues(idReadable)),customFields(name,value(name,id,login,fullName)),commentsCount';
export const detailFields = 'id,idReadable,summary,description,updated,project(shortName),parent(issues(idReadable)),customFields(id,name,$type,value(name,id,login,fullName)),commentsCount,comments(id,text,created,author(login,fullName))';
export const fixtureQuery = 'project: PMON issue ID: PMON-466, PMON-467, PMON-468 sort by: created asc';
export const metadataFields = 'id,name,size,mimeType,created,updated,author(id),removed,draft';
export const createGuard = ({ browser, fixture, run, recovery = false }) => {
  assert.ok((browser === 'chromium' && fixture === 'PMON-467') || (browser === 'firefox' && fixture === 'PMON-468'));
  if(recovery) { assert.equal(browser,'firefox');assert.equal(fixture,recoverySpec.fixture);run=recoverySpec.run; }
  assert.match(run, /^[a-z0-9][a-z0-9-]{0,39}$/);
  const name = `romdex-native-${fixture.toLowerCase()}-${run}.txt`;
  const bytes = Buffer.from(`ROMDex native attachment acceptance\n${fixture}\n${run}\n`);
  const base = `/api/issues/${fixture}/attachments`;
  const state = { baseline: false, posts: 0, deletes: 0, receipt: recovery ? recoverySpec.receipt : null, account: null, armed: false, halted: false };
  const files = new Set();
  const fail = () => { state.halted = true; throw Error('Native guard refused request or response.'); };
  const require = (condition) => { if (!condition) fail(); };
  const query = (url, expected) => require(url.searchParams.size === Object.keys(expected).length && Object.entries(expected).every(([key,value]) => url.searchParams.getAll(key).length === 1 && url.searchParams.get(key) === value));
  const authorize = ({ url: raw, method, contentType = '', body, redirected = false }) => {
    require(!state.halted && !redirected);
    if(recovery)require(method!=='POST');
    const url = new URL(raw);
    require(url.origin === tenant && !url.username && !url.password && !url.hash);
    if (method === 'GET' && url.pathname === '/api/users/me') { query(url,{fields:'id'}); return { url: raw, kind: 'account' }; }
    if (method === 'GET' && url.pathname === '/api/issues') {
      const skip=url.searchParams.get('$skip');
      require(/^(0|[1-9][0-9]*)$/.test(skip||'') && Number(skip)%100===0 && Number(skip)<=100000);
      query(url,{query:'project: PMON sort by: created asc',fields:taskFields,'$top':'100','$skip':skip});
      url.searchParams.set('query',fixtureQuery);
      return {url:url.href,kind:'tasks',skip:Number(skip)};
    }
    const taskId=url.pathname.match(/^\/api\/issues\/(PMON-\d+)$/)?.[1];
    if (method === 'GET' && taskId && Object.hasOwn(fixtures,taskId)) { query(url,{fields:detailFields}); return {url:raw,kind:'task',taskId}; }
    if (method === 'GET' && files.has(url.href)) return {url:raw,kind:'file'};
    require(url.pathname === base || (state.receipt && url.pathname === `${base}/${state.receipt}`));
    if (method === 'GET') {
      if (url.pathname === base) query(url,{fields:metadataFields,'$top':'100','$skip':'0'});
      else query(url,{fields:metadataFields+',url'});
    } else if (method === 'POST') {
      require(url.pathname === base && state.tasksVerified && state.baseline && state.account && state.posts === 0 && !state.receipt);
      query(url,{fields:'id'});
      const match = /^multipart\/form-data; boundary=([A-Za-z0-9'-]{1,100})$/.exec(contentType);
      require(match && Buffer.isBuffer(body));
      const boundary = match[1];
      const expected = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="upload"; filename="${name}"\r\nContent-Type: text/plain\r\n\r\n`),bytes,Buffer.from(`\r\n--${boundary}--\r\n`)]);
      // Browser multipart encoders may omit only the final CRLF.
      require(body.equals(expected) || body.equals(expected.subarray(0,expected.length-2)));
      state.posts++;
    } else if (method === 'DELETE') {
      require(state.armed && (recovery ? state.bytesVerified && state.metadataVerified : state.posts === 1) && state.receipt && url.pathname === `${base}/${state.receipt}` && state.deletes === 0 && !url.search && !body);
      state.deletes++; state.armed = false;
    } else fail();

    return {url:url.href,kind:method === 'GET' ? (url.pathname.endsWith('/attachments') ? 'inventory':'metadata') : method.toLowerCase()};
  };
  const validateTask = value => {
    const expected=Object.hasOwn(fixtures,value?.idReadable)?fixtures[value.idReadable]:null;
    require(expected && value.project?.shortName==='PMON' && value.summary===expected.title);
    const parents=value.parent?.issues ?? [];
    require(Array.isArray(parents) && (expected.parent ? parents.length===1 && parents[0].idReadable===expected.parent : parents.length===0));
  };
  const observe = ({ kind, status, value, skip, taskId }) => {
    require(!state.halted && status >= 200 && status < 300);
    if(kind==='tasks') {
      require(Array.isArray(value));
      require(skip===0 ? value.length===3 && new Set(value.map(task=>task.idReadable)).size===3 : value.length===0);
      value.forEach(validateTask);
      if(skip===0)state.tasksVerified=true;
    }
    if(kind==='task') { validateTask(value); require(value.idReadable===taskId); }
    if (kind === 'account') { require(value && typeof value.id === 'string' && /^[\w-]{1,100}$/.test(value.id)); if(recovery)require(value.id===recoverySpec.account);state.account = value.id; }
    if (kind === 'inventory') {
      require(Array.isArray(value));
      if (!recovery && !state.posts) { require(value.length === 0); state.baseline = true; }
      else if (state.deletes) { require(value.length === 0); state.deletedInventory = true; }
      else require(value.length === 1 && value[0].id === state.receipt && value[0].name === name && value[0].size === bytes.length && value[0].author?.id === state.account && !value[0].removed && !value[0].draft);
    }
    if (kind === 'post') { require(state.posts === 1 && !state.receipt && Array.isArray(value) && value.length === 1 && /^\d+-\d+$/.test(value[0]?.id)); state.receipt = value[0].id; }
    if (kind === 'metadata') {
      require(value?.id === state.receipt && value.name === name && value.size === bytes.length && value.author?.id === state.account && !value.removed && !value.draft && typeof value.url === 'string');
      const url = new URL(value.url,tenant);
      require(url.origin === tenant && !url.username && !url.password && !url.hash && /^\/(?:youtrack\/)?api\/files\/[^/]+/.test(url.pathname));
      if(recovery)require(value.mimeType==='text/plain' && value.created===1792950796859 && value.updated===1792950796817);
      files.add(url.href);state.metadataVerified=true;
    }
  };
  const armDelete = (id) => { require(!state.halted && id === state.receipt && !!id && state.deletes === 0 && (!recovery || (state.bytesVerified && state.metadataVerified))); state.armed = true; };
  return {name,bytes,state,authorize,observe,armDelete,halt:()=>{state.halted=true;}};
};






