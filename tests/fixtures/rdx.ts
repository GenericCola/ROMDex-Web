import type {JsonObject} from "../../src/domain/json";
import {documentRevision} from "../../src/rdx/container";
export const planDocument=():JsonObject=>{
 const document:JsonObject={format:"RDXDocument/1",documentId:"plan:fixture",datasetId:"dataset:fixture",revision:"0".repeat(64),parents:[],createdAt:"2026-10-22T00:00:00.000Z",origin:{role:"user",generator:"Synthetic browser fixture",synthetic:true},capabilities:{required:["org.romdex.rdx.container-v1","org.romdex.rdx.plan-v1"],optional:[]},extensions:{"org.romdex.fixture":{text:"synthetic compression fixture ".repeat(100)}},assetInventory:[],namespace:"org.romdex.tasks",kind:"plan",schemaVersion:1,content:{roots:["task:fixture"],tasks:[{taskId:"task:fixture",parentTaskId:null,declaredTier:"epic",title:"Synthetic task",description:"",status:"untouched",priority:"normal",complexity:null,fields:[],comments:[],attachments:[],baseRevision:null}],deletionRequests:[],history:[]},result:null};
 document.revision=documentRevision(document);return document;
};
