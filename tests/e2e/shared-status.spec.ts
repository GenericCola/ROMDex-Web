import {test,expect,type Page,type BrowserContext} from "@playwright/test";
import {LOCAL_ORIGIN} from "./local-origin";
import {sharedBackend} from "../unit/shared-status-fixture";
import type {TaskItem} from "../../src/domain/types";
const root="PMON-900001",child="PMON-900002";
const item=(id=root,state="To do",parentId:string|null=null):TaskItem=>({id,summary:id===root?"Shared Root":"Shared Child",description:"",parentId,state,assignedState:state,priority:"Normal",complexity:null,type:"Task",updated:1,comments:[],commentCount:0});
test.use({serviceWorkers:"block"});
test.setTimeout(60000);
const routeBackend=async(context:BrowserContext,backend:ReturnType<typeof sharedBackend>)=>{
  await context.route("https://thegobindsingh.youtrack.cloud/api/**",async route=>{
    const request=route.request(),headers={"access-control-allow-origin":"*","access-control-allow-headers":"authorization,accept,content-type","access-control-allow-methods":"GET, POST, DELETE, OPTIONS"};
    if(request.method()==="OPTIONS"){await route.fulfill({status:204,headers});return;}
    try{const body=request.postData();const response=await backend.fetcher(request.url(),{method:request.method(),...(body?{body}:{})});await route.fulfill({status:response.status,headers,contentType:"application/json",body:await response.text()});}catch{await route.abort();}
  });
};
const read=async(page:Page,count:number)=>{await page.goto(LOCAL_ORIGIN+"/");await page.getByRole("button",{name:"Connection Details",exact:true}).click();await page.getByLabel("YouTrack Permanent Token",{exact:true}).fill("fixture-read-token");await page.getByRole("button",{name:"Read YouTrack Tasks",exact:true}).click();await page.getByRole("button",{name:"Save "+count+" Tasks in This Browser",exact:true}).click();};
const open=async(page:Page)=>{await page.getByRole("button",{name:"Connection Details",exact:true}).click();};
const close=async(page:Page)=>{await page.getByRole("button",{name:"Close Connection Details",exact:true}).click();};
const connect=async(page:Page)=>{await open(page);await page.getByLabel("Session token for delivery",{exact:true}).fill("fixture-delivery-token");await page.getByRole("button",{name:"Enable delivery for this session",exact:true}).click();await expect(page.getByText("Saved. Use Save Changes to run one delivery cycle.",{exact:true})).toBeVisible();await close(page);};
const shared=async(page:Page)=>{await connect(page);await open(page);await page.getByRole("button",{name:"Preview shared assigned status",exact:true}).click();await expect(page.getByRole("table",{name:"Assigned-status comparison",exact:true})).toBeVisible();await page.getByRole("button",{name:"Use YouTrack choices and enable sharing",exact:true}).click();await expect(page.getByText(/Shared assigned status is enabled/)).toBeVisible();await close(page);};
const save=async(page:Page)=>{await page.getByRole("button",{name:/^Save Changes/}).click();};
const confirmed=async(page:Page)=>{await expect(page.getByText("Queued supported changes confirmed by YouTrack. Auto-Sync preference unchanged.",{exact:true})).toBeVisible();};
const selectRoot=async(page:Page)=>{await page.getByRole("button",{name:"Shared Root",exact:true}).last().click();};
test("independent devices share parent assignments and explicitly resolve an offline conflict",async({page,browser,context})=>{
  const backend=sharedBackend([item(),item(child,"Done",root)]);
  for(const [kind,value,opId]of [["assign","Standby","seed-assignment"],["rollup","Done","seed-rollup"]]){const current=backend.call(root,"GET").body as {revision:number;initialized:boolean;assignedState:string;state:string;updated:number};backend.call(root,"POST",{schema:1,opId,kind,value,expected:{revision:current.revision,initialized:current.initialized,assignedState:current.assignedState,state:current.state,updated:current.updated}});}
  await routeBackend(context,backend);await read(page,2);await shared(page);await selectRoot(page);await expect(page.getByRole("combobox",{name:"Assigned Status",exact:true})).toHaveValue("Standby");await save(page);await confirmed(page);
  const second=await browser.newContext({baseURL:LOCAL_ORIGIN,serviceWorkers:"block"});try{await routeBackend(second,backend);const other=await second.newPage();await read(other,2);await shared(other);await selectRoot(other);await expect(other.getByRole("combobox",{name:"Assigned Status",exact:true})).toHaveValue("Standby");await save(other);await confirmed(other);
    await page.getByRole("combobox",{name:"Assigned Status",exact:true}).selectOption("In Development");await save(page);await confirmed(page);await save(other);await confirmed(other);await expect(other.getByRole("combobox",{name:"Assigned Status",exact:true})).toHaveValue("In Development");expect(backend.tasks.get(root)?.state).toBe("Done");
    await other.getByRole("combobox",{name:"Assigned Status",exact:true}).selectOption("Done");await page.getByRole("combobox",{name:"Assigned Status",exact:true}).selectOption("Standby");await save(page);await confirmed(page);const count=backend.writes.length;await save(other);await expect(other.getByText("Review conflicting edits. Both versions were preserved.",{exact:true})).toBeVisible();expect(backend.writes).toHaveLength(count);await open(other);await other.getByRole("button",{name:"Keep my edit; rebase for next Save",exact:true}).click();await expect(other.getByRole("heading",{name:"Conflicting edits",exact:true})).toHaveCount(0);await close(other);await save(other);await confirmed(other);await save(page);await confirmed(page);await expect(page.getByRole("combobox",{name:"Assigned Status",exact:true})).toHaveValue("Done");expect(backend.ordinaryWrites).toHaveLength(0);
  }finally{await second.close();}
});
test("lost shared assignment response requires exact readback after reload without replay",async({page,context})=>{
  const backend=sharedBackend([item()]);await routeBackend(context,backend);await read(page,1);await shared(page);await save(page);await confirmed(page);await selectRoot(page);backend.options.lostAssign=true;await page.getByRole("combobox",{name:"Assigned Status",exact:true}).selectOption("Done");await save(page);await expect(page.getByText("The delivery result is uncertain. Your queued change is preserved for review.",{exact:true})).toBeVisible();expect(backend.writes).toHaveLength(1);await page.reload();await connect(page);await save(page);await expect(page.getByText("An earlier request has an uncertain result. Review it before sending more changes.",{exact:true})).toBeVisible();expect(backend.writes).toHaveLength(1);await open(page);await page.getByRole("button",{name:"Read back and confirm; do not resend",exact:true}).click();await expect(page.getByRole("heading",{name:"Uncertain delivery",exact:true})).toHaveCount(0);await close(page);await save(page);await confirmed(page);expect(backend.writes.filter(write=>(write.body as {kind:string}).kind==="assign")).toHaveLength(1);expect(backend.tasks.get(root)?.state).toBe("Done");expect(backend.ordinaryWrites).toHaveLength(0);
});
test("an unavailable metadata app blocks shared delivery without native State fallback",async({page,context})=>{
  const backend=sharedBackend([item()]);await routeBackend(context,backend);await read(page,1);await shared(page);await save(page);await confirmed(page);await selectRoot(page);await page.getByRole("combobox",{name:"Assigned Status",exact:true}).selectOption("Standby");backend.options.appMissing=true;await save(page);await expect(page.getByText("Invalid shared-status response. Nothing was replaced.",{exact:true})).toBeVisible();expect(backend.writes).toHaveLength(0);expect(backend.ordinaryWrites).toHaveLength(0);backend.options.appMissing=false;await save(page);await confirmed(page);expect(backend.tasks.get(root)?.state).toBe("Standby");
});

test("older Standby rollup rules display the compatibility refusal before metadata access",async({page,context})=>{
 const backend=sharedBackend([item()]),fetcher=backend.fetcher;let metadataReads=0;
 backend.fetcher=async(input,init)=>{
  const path=new URL(String(input)).pathname;
  if(path.endsWith("/capabilities/check"))return Response.json({schema:1,app:"romdex-status",project:"PMON",statusRules:2});
  if(path.endsWith("/status/assigned"))metadataReads++;
  return fetcher(input,init);
 };
 await routeBackend(context,backend);await read(page,1);await connect(page);await open(page);
 await page.getByRole("button",{name:"Preview shared assigned status",exact:true}).click();
 await expect(page.getByText("The ROMDex status app is unavailable or incompatible. Shared status was stopped.",{exact:true})).toBeVisible();
 await expect(page.getByRole("table",{name:"Assigned-status comparison",exact:true})).toHaveCount(0);
 expect(metadataReads).toBe(0);expect(backend.writes).toHaveLength(0);expect(backend.ordinaryWrites).toHaveLength(0);
});