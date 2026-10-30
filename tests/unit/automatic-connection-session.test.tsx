import {test} from "node:test";
import assert from "node:assert/strict";
import {workspaceStore} from "../../src/domain/workspace-store";
import {emptyWorkspace} from "../../src/domain/workspace-data";
import {connectDelivery,disconnectDelivery,deliveryConnected,automaticDelivery,saveDelivery} from "../../src/cloud/session";
test("automatic connection rejects wrong identity and keeps OFF manual delivery available",async t=>{
 const data=emptyWorkspace();data.cloud={autoSync:false,records:{}};
 const state={data,ready:true,error:"",pendingWrites:0,connection:"",updating:false,delivering:false};let writes=0,remote="other";
 t.mock.method(workspaceStore,"start",async()=>{});t.mock.method(workspaceStore,"getSnapshot",()=>state);
 t.mock.method(workspaceStore,"change",async(update:(d:typeof data)=>void)=>update(data));
 t.mock.method(workspaceStore,"flush",async()=>{});t.mock.method(workspaceStore,"setConnection",()=>{});
 t.mock.method(workspaceStore,"deliver",async()=>{writes++;});
 t.mock.method(globalThis,"fetch",async(_input,options)=>{assert.equal(options?.method,"GET");return Response.json({id:remote});});
 try{
  await assert.rejects(connectDelivery("synthetic","expected"),/identity differs/);assert.equal(deliveryConnected(),false);assert.equal(data.cloud.accountId,undefined);
  remote="expected";await connectDelivery("synthetic","expected");assert.equal(deliveryConnected(),true);automaticDelivery();assert.equal(writes,0);
  await saveDelivery();assert.equal(writes,1);assert.equal(data.cloud.autoSync,false);
 }finally{disconnectDelivery();}
});
