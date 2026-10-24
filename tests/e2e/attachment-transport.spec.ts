import {test,expect} from '@playwright/test';
test('native multipart transport carries Blob bytes without request interception',async({page})=>{
 await page.goto('/foundation/');const result=await page.evaluate(async()=>{const original=new Blob(['ROMDex transport fixture: \u00e9\n'],{type:'text/plain'});const form=new FormData();form.append('upload',new Blob([original],{type:'text/plain'}),'fixture.txt');return await (await fetch('/__attachment-transport',{method:'POST',body:form})).json();});const bytes=Buffer.from(result.body,'base64');expect(bytes.includes(Buffer.from('ROMDex transport fixture: \u00e9\n'))).toBe(true);
});
