import {test,expect} from '@playwright/test';

test('Chrome and Firefox install instructions are visible through the actual app controls',async({page})=>{
 await page.goto('/foundation/');await expect(page.getByText('Chrome: use Install ROMDex or the address-bar install icon. Firefox on Windows: use the address-bar web apps button. On iPhone or iPad, choose Share, then Add to Home Screen.',{exact:true})).toBeVisible();
});

test('standalone launch displays installed-app status',async({page})=>{
 await page.addInitScript(()=>{const match=window.matchMedia.bind(window);window.matchMedia=query=>{const result=match(query);if(query==='(display-mode: standalone)')Object.defineProperty(result,'matches',{value:true});return result;};});await page.goto('/foundation/');await expect(page.getByText('ROMDex is running as an installed app.',{exact:true})).toBeVisible();
});
