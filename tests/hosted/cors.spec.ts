import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

test('the real hosted UI receives a YouTrack authentication refusal through CORS',async({page},info)=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Connection Details',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Connection Details',exact:true});
 await dialog.getByLabel('YouTrack Permanent Token',{exact:true}).fill('romdex-origin-check-deliberately-invalid');
 const response=page.waitForResponse(response=>response.url().startsWith('https://thegobindsingh.youtrack.cloud/api/issues?')&&response.request().method()==='GET');
 await dialog.getByRole('button',{name:'Read YouTrack Tasks',exact:true}).click();
 const received=await response;
 expect(received.status()).toBe(401);
 const message=dialog.getByRole('status').filter({hasText:'YouTrack read failed (HTTP 401). Check token access to PMON.'});
 await expect(message).toBeVisible();await message.scrollIntoViewIfNeeded();await expect(message).toBeInViewport();
 await mkdir('artifacts/ui-repair',{recursive:true});
 await page.screenshot({path:`artifacts/ui-repair/hosted-cors-${info.project.name}.png`,fullPage:true});
 await writeFile(`artifacts/ui-repair/hosted-cors-${info.project.name}.json`,JSON.stringify({status:received.status(),origin:new URL(page.url()).origin,message:await message.innerText(),validCredentialUsed:false,cloudMutation:false},null,2)+'\n');
 await dialog.getByRole('button',{name:'Close Connection Details',exact:true}).click();
 await expect(page.getByRole('button',{name:'All Tasks 0',exact:true})).toBeVisible();
});
