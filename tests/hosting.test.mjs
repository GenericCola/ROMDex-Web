import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
test('Vercel preserves the static export and routes only approved same-origin APIs',async()=>{
 const config=JSON.parse(await readFile('vercel.json','utf8')),pkg=JSON.parse(await readFile('package.json','utf8'));
 assert.equal(config.framework,null);assert.equal(config.outputDirectory,'out');assert.equal(config.trailingSlash,undefined);assert.equal(pkg.engines.node,'24.x');assert.equal(pkg.packageManager,'pnpm@11.25.0');assert.equal(pkg.scripts.prebuild,'node scripts/lint.mjs --fix');assert.equal(config.installCommand,'corepack pnpm install --frozen-lockfile');assert.equal(config.buildCommand,'corepack pnpm build');
 for(const key of ['proxy','env','builds'])assert.equal(key in config,false,key+' must not add a backend or credentials');
 assert.deepEqual(config.rewrites,['auth/start','auth/callback','auth/session','auth/renew','auth/logout','auth/cancel','auth/token','youtrack','attachment'].map(path=>({source:'/api/'+path,destination:'/api'})));assert.deepEqual(config.functions,{'api/index.ts':{maxDuration:60}});
 let group;
 for(const line of (await readFile('public/_headers','utf8')).trim().split(/\r?\n/)){
  if(!line.startsWith('  ')){group=config.headers.find(rule=>rule.source===(line==='/*'?'/:path*':line));assert.ok(group,'Deployment policy covers '+line);continue;}
  const at=line.indexOf(':'),key=line.slice(2,at),value=line.slice(at+1).trim();assert.equal(group.headers.find(header=>header.key===key)?.value,value,key);
 }
 assert.deepEqual(config.headers.find(rule=>rule.source==='/').headers,config.headers.find(rule=>rule.source==='/:path*').headers);
 const worker=config.headers.find(rule=>rule.source==='/sw.js');assert.equal(worker.headers.find(header=>header.key==='Cache-Control').value,'no-cache');assert.equal(worker.headers.find(header=>header.key==='Service-Worker-Allowed').value,'/');
 const exclusions=(await readFile('.vercelignore','utf8')).split(/\r?\n/);for(const entry of ['.env*','artifacts','docs','tests','.git','.codex','*.pem','*.db','node_modules','out'])assert.ok(exclusions.includes(entry),entry+' is excluded from source uploads');
});
