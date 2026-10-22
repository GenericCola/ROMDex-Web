import { expect, type Page } from "@playwright/test";
type Task={id:string;summary:string;description:string;parentId:string|null;state:string;priority:string;complexity:string|null;type:string;updated:number};
export const structuralFixture=async(page:Page,mode:"normal"|"create-lost"|"delete-lost"|"move-lost"|"status-lost"="normal")=>{
  const tasks=new Map<string,Task>();for(const [id,summary,parentId] of [["PMON-900001","Fixture Root",null],["PMON-900002","Fixture Other",null],["PMON-900003","Fixture Child","PMON-900001"]] as const)tasks.set(id,{id,summary,parentId,description:"",state:"To do",priority:"Normal",complexity:null,type:"Task",updated:1});
  const writes:{method:string;path:string}[]=[];let creates=0,lost=false;
  const fields=["Type","State","Priority","Complexity"];
  const raw=(task:Task)=>({id:"2-"+task.id.split("-")[1],idReadable:task.id,summary:task.summary,description:task.description,updated:task.updated,project:{shortName:"PMON"},parent:{issues:task.parentId?[{idReadable:task.parentId}]:[]},customFields:fields.map((name,i)=>({id:"92-"+i,name,$type:name==="State"?"StateIssueCustomField":"SingleEnumIssueCustomField",value:task[name.toLowerCase() as "state"|"priority"|"complexity"|"type"]===null?null:{name:task[name.toLowerCase() as "state"|"priority"|"complexity"|"type"]}})),commentsCount:0,comments:[]});
  await page.route("https://thegobindsingh.youtrack.cloud/api/**",async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method();const headers={"access-control-allow-origin":"*","access-control-allow-headers":"authorization,accept,content-type","access-control-allow-methods":"GET, POST, DELETE, OPTIONS"};
    const reply=async(body:unknown,status=200)=>route.fulfill({headers,status,contentType:"application/json",body:JSON.stringify(body)});
    if(method==="OPTIONS"){await route.fulfill({status:204,headers});return;}
    if(method!=="GET")writes.push({method,path});
    if(path==="/api/users/me"){await reply({id:"fixture-owner"});return;}
    if(path==="/api/admin/projects"){await reply([{id:"0-1",shortName:"PMON"}]);return;}
    if(path==="/api/admin/projects/0-1/customFields"){await reply(fields.map((name,i)=>({id:"92-"+i,field:{name,fieldType:{id:name==="State"?"state[1]":"enum[1]"}}})));return;}
    if(path==="/api/issues"){
      if(method==="GET"){await reply([...tasks.values()].map(raw));return;}
      if(method==="POST"){const body=request.postDataJSON();const id="PMON-"+(900100+(++creates));const task:Task={id,summary:body.summary,description:body.description,parentId:null,state:"To do",priority:"Normal",complexity:null,type:"Task",updated:1};for(const field of body.customFields??[])task[field.name.toLowerCase() as "state"|"priority"|"complexity"|"type"]=field.value?.name??null;tasks.set(id,task);if(mode==="create-lost"&&!lost){lost=true;await route.abort();return;}await reply({idReadable:id});return;}
    }
    const parts=path.split("/");const id=parts[3]??"";const task=tasks.get(id);
    if(!task){await reply({error:"Not found"},404);return;}
    if(parts.length===4){
      if(method==="GET"){await reply(raw(task));return;}
      if(method==="POST"){const body=request.postDataJSON();for(const key of ["summary","description"] as const)if(key in body)task[key]=body[key];for(const field of body.customFields??[])task[field.name.toLowerCase() as "state"|"priority"|"complexity"|"type"]=field.value?.name??null;if(mode==="status-lost"&&!lost&&body.customFields?.some((field:{name:string})=>field.name==="State")){lost=true;await route.abort();return;}await reply({});return;}
      if(method==="DELETE"){tasks.delete(id);if(mode==="delete-lost"&&!lost){lost=true;await route.abort();return;}await route.fulfill({status:204,headers});return;}
    }
    if(parts[4]==="links"){
      if(parts.length===5){await reply([{id:"80-3s",direction:"OUTWARD",linkType:{name:"Subtask"}},{id:"80-3t",direction:"INWARD",linkType:{name:"Subtask"}}]);return;}
      if(method==="GET"){const entries=parts[5]==="80-3s"?[...tasks.values()].filter(entry=>entry.parentId===id):task.parentId?[tasks.get(task.parentId)].filter(Boolean):[];const skip=Number(url.searchParams.get("$skip")??0);await reply(entries.slice(skip,skip+100).map(entry=>({id:"2-"+entry!.id.split("-")[1],idReadable:entry!.id})));return;}
      if(method==="DELETE"){task.parentId=null;await route.fulfill({status:204,headers});return;}
      if(method==="POST"){if(mode==="move-lost"&&!lost){lost=true;await route.abort();return;}task.parentId=request.postDataJSON().id.replace(/^2-/,"PMON-");await reply({});return;}
    }
    throw Error("Unexpected fixture request "+method+" "+path);
  });
  await page.goto("/");await page.getByRole("button",{name:"Connection Details",exact:true}).click();await page.getByLabel("YouTrack Permanent Token",{exact:true}).fill("fixture-read-token");await page.getByRole("button",{name:"Read YouTrack Tasks",exact:true}).click();await page.getByRole("button",{name:"Save 3 Tasks in This Browser",exact:true}).click();
  const connect=async()=>{await page.getByRole("button",{name:"Connection Details",exact:true}).click();await page.getByLabel("Session token for delivery",{exact:true}).fill("fixture-session-token");await page.getByRole("button",{name:"Enable delivery for this session",exact:true}).click();await expect(page.getByText("Saved. Use Save Changes to run one delivery cycle.",{exact:true})).toBeVisible();await page.getByRole("button",{name:"Close Connection Details",exact:true}).click();};
  const save=async()=>{await page.getByRole("button",{name:/^Save Changes/}).click();};
  const confirmed=async()=>{await expect(page.getByText("Queued supported changes confirmed by YouTrack. Auto-Sync preference unchanged.",{exact:true})).toBeVisible();};
  const uncertain=async()=>{await expect(page.getByText("The delivery result is uncertain. Your queued change is preserved for review.",{exact:true})).toBeVisible();};
  return {tasks,writes,connect,save,confirmed,uncertain};
};
export const addTask=async(page:Page,title:string,parent?:string)=>{
  await page.getByRole("button",{name:parent?"Add child to "+parent:"Add Epic",exact:true}).click();await page.getByRole("dialog").getByLabel("Name",{exact:true}).fill(title);await page.getByRole("button",{name:"Create Item",exact:true}).click();
};
