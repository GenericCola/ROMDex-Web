import {test} from "node:test";
import assert from "node:assert/strict";
import {DeliveryClient} from "../../src/youtrack/delivery-client";
const raw=()=>({id:"2-test",idReadable:"PMON-900001",summary:"Fixture",description:"Before",updated:1,project:{shortName:"PMON"},parent:{issues:[]},customFields:[{id:"10-1",name:"Priority",$type:"SingleEnumIssueCustomField",value:{name:"Normal"}}],commentsCount:0,comments:[]});
test("delivery client sends only the fetched field schema with private no-store requests",async()=>{
  const original=globalThis.fetch;const calls:{url:string;init:RequestInit|undefined}[]=[];
  globalThis.fetch=async(input,init)=>{calls.push({url:String(input),init});return Response.json(init?.method==="POST"?{}:String(input).includes("users/me")?{id:"fixture-owner"}:raw());};
  try{const client=new DeliveryClient("fixture-token");await client.connect();await client.get("PMON-900001");await client.update("PMON-900001",{priority:"High",description:"After"});
    assert.equal(calls.length,3);assert.deepEqual(JSON.parse(String(calls[2]?.init?.body)),{description:"After",customFields:[{id:"10-1",name:"Priority",$type:"SingleEnumIssueCustomField",value:{name:"High"}}]});
    for(const call of calls){assert.equal(call.init?.cache,"no-store");assert.equal(call.init?.credentials,"omit");assert.equal(call.init?.redirect,"error");assert.equal((call.init?.headers as Record<string,string>).Authorization,"Bearer fixture-token");assert.equal(call.url.includes("fixture-token"),false);}
  }finally{globalThis.fetch=original;}
});
test("wrong issue IDs and malformed readbacks are rejected before a write",async()=>{
  const original=globalThis.fetch;let posts=0;let response:unknown={...raw(),idReadable:"PMON-900002"};globalThis.fetch=async(_input,init)=>{if(init?.method==="POST")posts++;return Response.json(response);};
  try{const client=new DeliveryClient("fixture-token");await assert.rejects(client.get("PMON-900001"),/different task/);response={...raw(),description:42};await assert.rejects(client.get("PMON-900001"),/Invalid task/);assert.equal(posts,0);}finally{globalThis.fetch=original;}
});
test("comment confirmation requires the exact ID, text and undeleted record",async()=>{
  const original=globalThis.fetch;let response:unknown={id:"4-124",text:"Same text",deleted:false};globalThis.fetch=async()=>Response.json(response);
  try{const client=new DeliveryClient("fixture-token");await assert.rejects(client.verifyComment("PMON-900001","4-123","Same text"),/does not match/);response={id:"4-123",text:"Same text",deleted:true};await assert.rejects(client.verifyComment("PMON-900001","4-123","Same text"),/does not match/);response={id:"4-123",text:"Same text",deleted:false};await client.verifyComment("PMON-900001","4-123","Same text");}finally{globalThis.fetch=original;}
});
