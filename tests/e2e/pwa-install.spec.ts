import {test,expect} from '@playwright/test';
import {openLocalWorkspace,routeLocalWorkspace} from './local-workspace';

test('Chrome and Firefox install instructions are visible through the actual app controls',async({page})=>{
 await page.goto('/foundation/');await expect(page.getByText('Chrome: use Install ROMDex or the address-bar install icon. Firefox on Windows: use the address-bar web apps button. On iPhone or iPad, choose Share, then Add to Home Screen.',{exact:true})).toBeVisible();
});

test('standalone launch displays installed-app status',async({page})=>{
 await page.addInitScript(()=>{const match=window.matchMedia.bind(window);window.matchMedia=query=>{const result=match(query);if(query==='(display-mode: standalone)')Object.defineProperty(result,'matches',{value:true});return result;};});await page.goto('/foundation/');await expect(page.getByText('ROMDex is running as an installed app.',{exact:true})).toBeVisible();
});

test('install help, installed status and a recovery copy are in the app TOOLS menu',async({page})=>{
 await page.addInitScript(()=>{const match=window.matchMedia.bind(window);window.matchMedia=query=>{const result=match(query);if(query==='(display-mode: standalone)')Object.defineProperty(result,'matches',{value:true});return result;};});
 await routeLocalWorkspace(page.context());await openLocalWorkspace(page);
 await page.getByRole('button',{name:'TOOLS',exact:true}).click();await page.getByRole('button',{name:'INSTALL ROMDEX',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Install ROMDex'});await expect(dialog.getByText('ROMDex is running as an installed app.',{exact:true})).toBeVisible();
 await dialog.getByRole('button',{name:'Close Install ROMDex',exact:true}).click();
 await page.getByRole('button',{name:'TOOLS',exact:true}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'EXPORT RECOVERY COPY',exact:true}).click();
 expect((await download).suggestedFilename()).toMatch(/^ROMDex-Web-Recovery-.*\.json$/);
 await expect(page.getByRole('button',{name:'Import Desktop or Recovery Data',exact:true})).toHaveCount(0);
});
