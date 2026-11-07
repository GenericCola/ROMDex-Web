import {test} from "node:test";
import assert from "node:assert/strict";
import {STATES,rollup,indexTree,statusOf} from "../../src/domain/accepted/core.mjs";
import type {LampColor,TaskItem} from "../../src/domain/types";
const root="PMON-900001",child="PMON-900002",leaf="PMON-900003";
const item=(id:string,state:string,parentId:string|null=null):TaskItem=>({id,summary:id,description:"",state,assignedState:state,parentId,priority:"Normal",complexity:null,type:"Task",updated:1,comments:[],commentCount:0});

test("Standby rolls up only from at least two all-Standby immediate children",()=>{
 assert.equal(rollup([]),null);assert.equal(statusOf("Standby"),"blue");assert.equal(statusOf("Prompt Ready"),"blue");
 const cases:Array<[LampColor[],LampColor]>=[[["blue"],"yellow"],[["blue","blue"],"blue"],[["blue","blue","blue"],"blue"],[["blue","green"],"yellow"],[["blue","grey"],"yellow"],[["blue","yellow"],"yellow"],[["blue","purple"],"purple"],[["blue","red"],"red"],[["blue","amber"],"amber"],[["green","green"],"green"],[["grey","grey"],"grey"]];
 for(const [colors,expected] of cases){assert.equal(rollup(colors),expected);}
 const colors=Object.keys(STATES) as LampColor[];
 for(const a of colors)for(const b of colors)for(const c of colors){assert.equal(rollup([a,b,c])==="blue",[a,b,c].every(x=>x==="blue"));}
 const tasks=[item(root,"Standby"),item(child,"Standby",root),item(leaf,"Prompt Ready",child)];
 const tree=indexTree(tasks);assert.equal(tree.colors.get(root),"yellow");assert.equal(tree.colors.get(child),"yellow");assert.equal(tree.colors.get(leaf),"blue");assert.equal(tasks[0]?.assignedState,"Standby");assert.equal(indexTree([tasks[0]!]).colors.get(root),"blue");
});
