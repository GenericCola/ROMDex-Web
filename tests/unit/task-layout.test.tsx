import {test} from "node:test";
import assert from "node:assert/strict";
import {emptyWorkspace,validateWorkspace} from "../../src/domain/workspace-data";
import {moveSibling} from "../../src/domain/task-layout";
import {indexTree} from "../../src/domain/accepted/core.mjs";
import {createTask} from "../../src/domain/task-actions";
import {completeCreation} from "../../src/cloud/creation";
import type {TaskItem} from "../../src/domain/types";
const item=(id:string,parentId:string|null=null):TaskItem=>({id,parentId,summary:id,description:"",state:"To do",priority:"Normal",complexity:null,type:"Task",updated:1,comments:[],commentCount:0});
test("sibling reordering preserves hierarchy and leaves unrelated siblings alone",()=>{
 const data=emptyWorkspace();data.remote=[item("PMON-1"),item("PMON-2"),item("PMON-3","PMON-1"),item("PMON-4","PMON-1"),item("PMON-5","PMON-2")];
 moveSibling(data,"PMON-4",-1);const tree=indexTree(data.remote,data.order);assert.deepEqual(tree.children.get("PMON-1")?.map(i=>i.id),["PMON-4","PMON-3"]);assert.equal(data.order["PMON-5"],undefined);assert.equal(data.remote[3]?.parentId,"PMON-1");
});
test("creation acknowledgement remaps local task images and refuses conflicting destinations",()=>{
 const data=emptyWorkspace(),id=createTask(data,null,"Synthetic image task"),operation=data.operations[0];assert.equal(operation?.type,"create");if(operation?.type!=="create")throw Error("fixture");
 data.images={[id]:"data:image/png;base64,AA=="};completeCreation(data,operation,item("PMON-100"));assert.equal(data.images["PMON-100"],"data:image/png;base64,AA==");assert.equal(data.images[id],undefined);
 const another=emptyWorkspace(),local=createTask(another,null,"Conflict"),op=another.operations[0];another.images={[local]:"data:image/png;base64,AA==","PMON-101":"data:image/png;base64,AQ=="};if(op?.type!=="create")throw Error("fixture");assert.throws(()=>completeCreation(another,op,item("PMON-101")),/different drafts/);assert.equal(another.operations.length,1);
});
test("invalid NPCDex saved positions cannot enter the workspace",()=>{
 const data=emptyWorkspace();data.view.npcdex={target:{town:"",area:"",element:"",point:"",block:""},gender:"unknown",stage:""};assert.throws(()=>validateWorkspace(data),/saved position/);
});
