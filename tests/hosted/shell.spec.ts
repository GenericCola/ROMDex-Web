import {test,expect} from '@playwright/test';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

test('hosted headers and every cached asset match the worker content inventory',async({request},info)=>{
 const config=JSON.parse(await readFile('vercel.json','utf8'));
 const home=await request.get('/');expect(home.status()).toBe(200);
 for(const header of config.headers.find((rule:{source:string})=>rule.source==='/').headers)expect(home.headers()[header.key.toLowerCase()]).toBe(header.value);
 const sw=await request.get('/sw.js');expect(sw.headers()['cache-control']).toBe('no-cache');expect(sw.headers()['service-worker-allowed']).toBe('/');
 const text=await sw.text(),version=/const CACHE = "romdex-shell-([a-f0-9]{20})";/.exec(text)?.[1],inventory=/const ASSETS = (\[[^\n]+\]);/.exec(text)?.[1];expect(version).toBeTruthy();expect(inventory).toBeTruthy();
 const assets=JSON.parse(inventory!) as string[];expect(assets.length).toBeGreaterThan(60);expect(assets).toContain('/index.html');expect(assets.some(path=>path.endsWith('.map'))).toBe(false);
 const template=execFileSync('git',['show','HEAD:scripts/service-worker.js']);const hash=createHash('sha256').update(template),files:Record<string,string>={};
 for(const path of assets){expect(path.startsWith('/')&&!path.startsWith('//')&&!path.includes('..')&&!/[?#]/.test(path),path).toBe(true);const response=await request.get(path);expect(response.status(),path).toBe(200);const bytes=await response.body();hash.update(path).update(bytes);files[path]=createHash('sha256').update(bytes).digest('hex');}
 expect(hash.digest('hex').slice(0,20)).toBe(version);expect(text).toBe(template.toString().replace('__VERSION__',version!).replace('__ASSETS__',JSON.stringify(assets)));
 expect((await request.get('/missing-romdex-acceptance-route/')).status()).toBe(404);const manifest=await (await request.get('/manifest.webmanifest')).json();expect(manifest.display).toBe('standalone');expect(manifest.start_url).toBe('/');
 await mkdir('artifacts/task-first-migration',{recursive:true});await writeFile('artifacts/task-first-migration/hosted-inventory-'+info.project.name+'.json',JSON.stringify({version,files,sourceWorkerSha256:createHash('sha256').update(template).digest('hex')},null,2)+'\n');
});

test('hosted app renders without reading YouTrack or importing desktop data',async({page},info)=>{
 let requests=0;await page.route('https://thegobindsingh.youtrack.cloud/**',async route=>{requests++;await route.abort();});await page.goto('/');await expect(page.getByRole('heading',{name:'ROMDex',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'All Tasks 0',exact:true})).toBeVisible();await expect(page.getByText('All changes saved in this browser',{exact:true})).toBeVisible();expect(requests).toBe(0);
 await mkdir('artifacts/task-first-migration',{recursive:true});await page.screenshot({path:'artifacts/task-first-migration/hosted-'+info.project.name+'.png',fullPage:true});
});

test('hosted app preserves a local note across offline reopening',async({page,context})=>{
 await page.goto('/');await page.getByRole('button',{name:'Add Epic',exact:true}).click();await page.getByRole('dialog').getByLabel('Name',{exact:true}).fill('Hosted synthetic local task');await page.getByRole('button',{name:'Create Item',exact:true}).click();await page.getByRole('textbox',{name:'Notes and Instructions',exact:true}).fill('Offline note fixture; no cloud request.');await expect(page.getByText('All changes saved in this browser',{exact:true})).toBeVisible();await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));});await context.setOffline(true);await page.reload();await expect(page.getByRole('textbox',{name:'Notes and Instructions',exact:true})).toHaveValue('Offline note fixture; no cloud request.');await context.setOffline(false);
});
