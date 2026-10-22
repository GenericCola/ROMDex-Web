import {test} from "node:test";
import assert from "node:assert/strict";
import {STATES,statusOf,rollup,indexTree} from "../../src/domain/accepted/core.mjs";
import type {LampColor,TaskItem} from "../../src/domain/types";
test("Awaiting Testing follows In Development and takes precedence over every other child status",()=>{
  const states=Object.values(STATES);assert.equal(states[states.indexOf("In Development")+1],"Awaiting Testing");assert.equal(statusOf("Awaiting Testing"),"amber");
  for(const [other,expected] of [["green","amber"],["amber","amber"],["grey","amber"],["yellow","amber"],["blue","amber"],["purple","amber"],["red","amber"]] as [LampColor,LampColor][]){assert.equal(rollup(["amber",other]),expected);assert.equal(rollup([other,"amber"]),expected);}
  const item=(id:string,state:string,parentId:string|null):TaskItem=>({id,summary:id,description:"",state,assignedState:state,parentId,priority:"Normal",complexity:null,type:"Task",updated:1,comments:[],commentCount:0});
  const tree=indexTree([item("root","Standby",null),item("child","Awaiting Testing","root")]);assert.equal(tree.colors.get("root"),"amber");assert.equal(tree.colors.get("child"),"amber");
});
