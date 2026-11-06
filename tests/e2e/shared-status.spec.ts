import {test,expect,type Page} from "@playwright/test";
import {installCookieFixture,openCookieFixture,routeYouTrack} from "./cookie-fixture";
import {setStatus,expectAssigned} from "./task-status";
import {sharedBackend} from "../unit/shared-status-fixture";
import type {TaskItem} from "../../src/domain/types";
const root="PMON-900001",child="PMON-900002";
const item=(id=root,state="To do",parentId:string|null=null):TaskItem=>({id,summary:id===root?"Shared Root":"Shared Child",description:"",parentId,state,assignedState:state,priority:"Normal",complexity:null,type:"Task",updated:1,comments:[],commentCount:0});
test.use({serviceWorkers:"block"});
test.setTimeout(60000);
const fields=["Type","State","Priority","Complexity"];
// The signed-in session is scoped to project 0-1, so issues from the unit backend must carry its id.
const withProjectId=(text:string)=>{const parsed=JSON.parse(text) as unknown;if(parsed===null||typeof parsed!=="object")return text;for(const issue of (Array.isArray(parsed)?parsed:[parsed]) as {project?:{id?:string}}[])if(issue.project&&!issue.project.id)issue.project.id="0-1";return JSON.stringify(parsed);};
const routeBackend=async(page:Page,backend:ReturnType<typeof sharedBackend>)=>{
  await installCookieFixture(page);
  await routeYouTrack(page,"https://thegobindsingh.youtrack.cloud/api/**",async route=>{
    const request=route.request(),path=new URL(request.url()).pathname,headers={"access-control-allow-origin":"*","access-control-allow-headers":"authorization,accept,content-type","access-control-allow-methods":"GET, POST, DELETE, OPTIONS"};
    if(request.method()==="OPTIONS"){await route.fulfill({status:204,headers});return;}
    // Store sync and project discovery sit outside the shared-status backend.
    if(path==="/api/articles"){await route.fulfill({headers,json:[]});return;}
    if(path==="/api/admin/projects"){await route.fulfill({headers,json:[{id:"0-1",shortName:"PMON"}]});return;}
    if(path==="/api/admin/projects/0-1/customFields"){await route.fulfill({headers,json:fields.map((name,i)=>({id:"92-"+i,field:{name,fieldType:{id:name==="State"?"state[1]":"enum[1]"}}}))});return;}
    try{const body=request.postData();const response=await backend.fetcher(request.url(),{method:request.method(),...(body?{body}:{})});const text=await response.text();await route.fulfill({status:response.status,headers,contentType:"application/json",body:withProjectId(text)});}catch{await route.abort();}
  });
  await openCookieFixture(page);
};
const read=routeBackend;
const open=async(page:Page)=>{await page.getByRole("button",{name:/^Connection Details/}).click();};
const close=async(page:Page)=>{await page.getByRole("button",{name:"Close Connection Details",exact:true}).click();};
const connect=async(page:Page)=>{await expect(page.getByRole("button",{name:/^Save Changes/})).toBeVisible();};
const shared=async(page:Page)=>{await connect(page);await open(page);await page.getByRole("button",{name:"Preview shared assigned status",exact:true}).click();await expect(page.getByRole("table",{name:"Assigned-status comparison",exact:true})).toBeVisible();await page.getByRole("button",{name:"Use YouTrack choices and enable sharing",exact:true}).click();await expect(page.getByText(/Shared assigned status is enabled/)).toBeVisible();await close(page);};
const save=async(page:Page)=>{await page.getByRole("button",{name:/^Save Changes/}).click();};
const confirmed=async(page:Page)=>{await expect(page.getByText("Queued supported changes confirmed by YouTrack. Auto-Sync preference unchanged.",{exact:true})).toBeVisible();};
const selectRoot=async(page:Page)=>{await page.getByRole("button",{name:"Shared Root",exact:true}).last().click();};
test("independent devices share parent assignments and explicitly resolve an offline conflict",async({page,browser})=>{
  const backend=sharedBackend([item(),item(child,"Done",root)]);
  for(const [kind,value,opId]of [["assign","Standby","seed-assignment"],["rollup","Done","seed-rollup"]]){const current=backend.call(root,"GET").body as {revision:number;initialized:boolean;assignedState:string;state:string;updated:number};backend.call(root,"POST",{schema:1,opId,kind,value,expected:{revision:current.revision,initialized:current.initialized,assignedState:current.assignedState,state:current.state,updated:current.updated}});}
  await read(page,backend);await shared(page);await selectRoot(page);await expectAssigned(page,"Shared Root","Standby");await save(page);await confirmed(page);
  const second=await browser.newContext({serviceWorkers:"block"});try{const other=await second.newPage();await read(other,backend);await shared(other);await selectRoot(other);await expectAssigned(other,"Shared Root","Standby");await save(other);await confirmed(other);
    await setStatus(page,"Shared Root","In Development");await save(page);await confirmed(page);await save(other);await confirmed(other);await expectAssigned(other,"Shared Root","In Development");expect(backend.tasks.get(root)?.state).toBe("Done");
    await setStatus(other,"Shared Root","Complete");await setStatus(page,"Shared Root","Standby");await save(page);await confirmed(page);const count=backend.writes.length;await save(other);await expect(other.getByText("Review conflicting edits. Both versions were preserved.",{exact:true})).toBeVisible();expect(backend.writes).toHaveLength(count);await open(other);await other.getByRole("button",{name:/^Use my (choice|changes)/}).click();await expect(other.locator(".delivery-review-card")).toHaveCount(0);await close(other);await save(other);await confirmed(other);await save(page);await confirmed(page);await expectAssigned(page,"Shared Root","Complete");expect(backend.ordinaryWrites).toHaveLength(0);
  }finally{await second.close();}
});
test("lost shared assignment response requires exact readback after reload without replay",async({page})=>{
  const backend=sharedBackend([item()]);await read(page,backend);await shared(page);await save(page);await confirmed(page);await selectRoot(page);backend.options.lostAssign=true;await setStatus(page,"Shared Root","Complete");await save(page);await expect(page.getByText("The delivery result is uncertain. Your queued change is preserved for review.",{exact:true})).toBeVisible();expect(backend.writes).toHaveLength(1);await page.reload();await connect(page);await save(page);await expect(page.getByText("An earlier request has an uncertain result. Review it before sending more changes.",{exact:true})).toBeVisible();expect(backend.writes).toHaveLength(1);await open(page);await page.getByRole("button",{name:"Check whether this saved",exact:true}).click();await expect(page.locator(".delivery-review-card")).toHaveCount(0);await close(page);await save(page);await confirmed(page);expect(backend.writes.filter(write=>(write.body as {kind:string}).kind==="assign")).toHaveLength(1);expect(backend.tasks.get(root)?.state).toBe("Done");expect(backend.ordinaryWrites).toHaveLength(0);
});
test("an unavailable metadata app blocks shared delivery without native State fallback",async({page})=>{
  const backend=sharedBackend([item()]);await read(page,backend);await shared(page);await save(page);await confirmed(page);await selectRoot(page);await setStatus(page,"Shared Root","Standby");backend.options.appMissing=true;await save(page);await expect(page.getByText("Invalid shared-status response. Nothing was replaced.",{exact:true})).toBeVisible();expect(backend.writes).toHaveLength(0);expect(backend.ordinaryWrites).toHaveLength(0);backend.options.appMissing=false;await save(page);await confirmed(page);expect(backend.tasks.get(root)?.state).toBe("Standby");
});

test("older Standby rollup rules display the compatibility refusal before metadata access",async({page})=>{
 const backend=sharedBackend([item()]),fetcher=backend.fetcher;let metadataReads=0;
 backend.fetcher=async(input,init)=>{
  const path=new URL(String(input)).pathname;
  if(path.endsWith("/capabilities/check"))return Response.json({schema:1,app:"romdex-status",project:"PMON",statusRules:2});
  if(path.endsWith("/status/assigned"))metadataReads++;
  return fetcher(input,init);
 };
 await read(page,backend);await connect(page);await open(page);
 await page.getByRole("button",{name:"Preview shared assigned status",exact:true}).click();
 await expect(page.getByText("The ROMDex status app is unavailable or incompatible. Shared status was stopped.",{exact:true})).toBeVisible();
 await expect(page.getByRole("table",{name:"Assigned-status comparison",exact:true})).toHaveCount(0);
 expect(metadataReads).toBe(0);expect(backend.writes).toHaveLength(0);expect(backend.ordinaryWrites).toHaveLength(0);
});