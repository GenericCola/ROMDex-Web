import {test,expect} from "@playwright/test";
import {archiveFiles,createBackend} from "../youtrack/fixture.mjs";
const mount = async(page,server,registerFailure=false)=>{
 const errors=[];page.on("pageerror",(error)=>errors.push(error.message));
 await page.route("**/yt-qa/**",async(route)=>{
  const pathname=new URL(route.request().url()).pathname;
  if(pathname.endsWith("/rpc")){
   const {path,options,id}=route.request().postDataJSON(),result=server.dispatch(path,options,id);
   await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({status:result.status,body:result.body})});return;
  }
  const key=pathname.slice("/yt-qa/".length),source=archiveFiles.get(key);
  expect(source,"archive asset resolves: "+key).toBeDefined();
  await route.fulfill({status:200,contentType:key.endsWith(".html")?"text/html":"application/javascript",body:source});
 });
 await page.addInitScript(({registerFailure})=>{
  window.YTApp={register:async()=>{
   if(registerFailure)throw Error("Synthetic SDK unavailable");
   const send=async(path,options,id="NPCD-872")=>{
    if(!options||typeof options.scope!=="boolean")throw Error("Missing SDK scope options");
    const response=await fetch("/yt-qa/rpc",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path,options,id})}),result=await response.json();
    if(result.status>=400)throw {status:result.status,message:result.body?.error??""};return result.body;
   };
   return {fetchApp:send,fetchYouTrack:async(path)=>{
    if(path!=="issues/NPCD-873/extensionEndpoints/romdex-status-acceptance/status/assigned")throw Error("Unexpected route");
    return send("status/assigned",{scope:true},"NPCD-873");
   }};
  }};
 },{registerFailure});
 await page.goto("/yt-qa/widgets/acceptance/index.html");
 return errors;
};
test("packaged widget completes root checks, reload and honest pending rollback through rendered buttons",async({page})=>{
 const server=createBackend(),errors=await mount(page,server);
 await expect(page.getByRole("status")).toHaveText("Ready. No request is sent until you choose a test.");
 expect(server.requests).toHaveLength(0);
 await page.getByRole("button",{name:"Run assignment, rollup and concurrency checks"}).click();
 await expect(page.getByRole("status")).toContainText("same-revision concurrent requests admit exactly one writer with an exact receipt and HTTP 409 loser");
 await expect(page.getByRole("status")).not.toContainText("FAIL");
 const before=structuredClone(server.tasks);
 await page.getByRole("button",{name:"Run forced rollback check"}).click();
 await expect(page.getByRole("status")).toContainText("PENDING verify this exact post-mutation marker");
 await expect(page.getByRole("status")).not.toContainText("FAIL");
 expect(server.tasks).toEqual(before);
 await page.reload();await page.getByRole("button",{name:"Read live metadata"}).click();
 await expect(page.getByRole("status")).toContainText('"state": "Done"');
 expect(server.tasks).toEqual(before);
 const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));expect(width.scroll).toBeLessThanOrEqual(width.viewport);expect(errors).toEqual([]);
});
test("packaged widget displays empty HTTP failures and restores its controls",async({page})=>{
 const server=createBackend();server.options.throwOnRead=true;const errors=await mount(page,server);
 await page.getByRole("button",{name:"Read live metadata"}).click();
 await expect(page.getByRole("status")).toContainText("FAIL HTTP 500: Request failed; check the app log.");
 await expect(page.getByRole("button",{name:"Run assignment, rollup and concurrency checks"})).toBeEnabled();
 expect(server.commits).toHaveLength(0);expect(errors).toEqual([]);
});
test("registration failure is visible and keeps all mutation buttons disabled",async({page})=>{
 const server=createBackend(),errors=await mount(page,server,true);
 await expect(page.getByRole("status")).toContainText("FAIL widget registration: Synthetic SDK unavailable");
 for(const name of ["Read live metadata","Run assignment, rollup and concurrency checks","Run forced rollback check"])await expect(page.getByRole("button",{name})).toBeDisabled();
 expect(server.requests).toHaveLength(0);expect(errors).toEqual([]);
});
