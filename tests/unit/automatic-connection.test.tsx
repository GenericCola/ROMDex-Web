import { test } from "node:test";
import assert from "node:assert/strict";
import { connectProject } from "../../src/auth/connect-project";
import { initializeAutomaticSync, connectionNeedsManualSave } from "../../src/cloud/connection-policy";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { initializeWorkspaceTasks } from "../../src/auth/initialize-workspace";
test("only validated PMON connects; failure preserves sign-in as warning, stale work rejects",async()=>{
 let calls=0,current=true;const check=()=>{if(!current)throw Error("cancelled");};
 const connect=async()=>{calls++;};
 assert.equal(await connectProject("synthetic",{id:"0-1",name:"PMON",shortName:"PMON"},check,connect),"");
 assert.equal(calls,1);
 assert.equal(await connectProject("synthetic",{id:"0-2",name:"Other",shortName:"OTHER"},check,connect),"");
 assert.equal(calls,1);
 const p={id:"0-1",name:"PMON",shortName:"PMON"};
 assert.match(await connectProject("synthetic",p,check,async()=>{throw Error("unavailable");}),/Signed in, but data connection/);
 await assert.rejects(connectProject("synthetic",p,check,async()=>{current=false;}),/cancelled/);
});
test("new scoped workspace defaults ON before adoption; existing OFF and unknown legacy stay unchanged",()=>{
 const fresh=emptyWorkspace();initializeWorkspaceTasks(fresh,[{id:"PMON-900001",summary:"Synthetic",description:"",parentId:null,state:"To do",priority:"Normal",complexity:"LOW",type:"Task",updated:1}],true);assert.equal(fresh.cloud?.autoSync,true);
 const off=emptyWorkspace();off.cloud={autoSync:false,records:{}};initializeAutomaticSync(off,true);assert.equal(off.cloud.autoSync,false);
 const legacy=emptyWorkspace();initializeAutomaticSync(legacy,false);assert.equal(legacy.cloud,undefined);
});
test("reconnection keeps every unresolved or reviewed journal operation paused",()=>{
 const data=emptyWorkspace();assert.equal(connectionNeedsManualSave(data),false);
 for(const status of ["ready","conflict","attempting","uncertain"] as const){data.cloud={autoSync:true,records:{op:{status,message:"synthetic"}}};assert.equal(connectionNeedsManualSave(data),true);}
 data.cloud={autoSync:false,records:{op:{status:"confirmed",message:"synthetic"}}};assert.equal(connectionNeedsManualSave(data),false);assert.equal(data.cloud.autoSync,false);
});
test("terminal connect rejection is fail-closed even if session storage cannot clear",async()=>{
 const {YouTrackHttpError}=await import('../../src/youtrack/http-error');
 const {setAuthSession,hasAuthSession}=await import('../../src/auth/session');
 const {OAUTH_ORIGIN}=await import('../../src/auth/origins');
 const prior=Object.getOwnPropertyDescriptor(globalThis,'window');
 Object.defineProperty(globalThis,'window',{configurable:true,value:{location:{origin:OAUTH_ORIGIN},sessionStorage:{removeItem:()=>{throw Error('storage unavailable');}}}});
 try{setAuthSession({token:'synthetic',userId:'1-1',projectId:'0-1',expiresAt:Date.now()+60000});await assert.rejects(connectProject('synthetic',{id:'0-1',name:'PMON',shortName:'PMON'},()=>{},async()=>{throw new YouTrackHttpError(401);}),/access changed/);assert.equal(hasAuthSession(),false);}
 finally{setAuthSession(null);if(prior)Object.defineProperty(globalThis,'window',prior);else Reflect.deleteProperty(globalThis,'window');}
});
