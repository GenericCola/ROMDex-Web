import {test} from "node:test";
import assert from "node:assert/strict";
import {emptyWorkspace} from "../../src/domain/workspace-data";
import {createTask,editTask} from "../../src/domain/task-actions";
import {materialize,indexTree} from "../../src/domain/accepted/core.mjs";
import {emptyFilters,matchesFilters} from "../../src/domain/task-filters";
import {normalize} from "../../src/youtrack/read-tasks";
test("filters match effective full-tree status and intersect metadata without changing tasks",()=>{
 const data=emptyWorkspace(),root=createTask(data,null,"Parent"),child=createTask(data,root,"Testing child"),done=createTask(data,null,"Done task");
 editTask(data,child,{assignedState:"Needs Testing"});editTask(data,done,{assignedState:"Done"});
 const items=materialize([],data.operations),tree=indexTree(items),before=JSON.stringify(items),filters={...emptyFilters(),status:"amber"};
 assert.deepEqual(items.filter(item=>matchesFilters(item,tree,filters)).map(item=>item.id),[root,child]);
 assert.equal(items.filter(item=>matchesFilters(item,tree,{...filters,priority:"Critical"})).length,0);
 assert.equal(items.filter(item=>matchesFilters(item,tree,{...emptyFilters(),complexity:"__unset",assignee:"__unassigned"})).length,3);
 assert.equal(JSON.stringify(items),before);
});
test("YouTrack assignees include stable identities for single and multi choice fields",()=>{
 const raw={id:"2-x",idReadable:"PMON-900001",summary:"Fixture",description:null,updated:1,project:{shortName:"PMON"}};
 const person={id:"1-1",fullName:"Synthetic Person",login:"synthetic"};
 const item=normalize({...raw,customFields:[{name:"Assignee",value:person}]});
 assert.deepEqual(item.assignees,[{id:"1-1",name:"Synthetic Person"}]);
 const tree=indexTree([item]);assert.ok(matchesFilters(item,tree,{...emptyFilters(),assignee:"1-1"}));assert.ok(!matchesFilters(item,tree,{...emptyFilters(),assignee:"__unassigned"}));
 assert.equal(normalize({...raw,customFields:[{name:"Assignee",value:[person]}]}).assignees?.length,1);
});

import {workRows} from "../../src/domain/work-rows";
test("row filters intersect scope and search, override Hide Completed for explicit status and leave expansion unchanged",()=>{
 const data=emptyWorkspace(),parent=createTask(data,null,"Parent"),child=createTask(data,parent,"Child"),other=createTask(data,null,"Elsewhere");editTask(data,child,{assignedState:"Done"});editTask(data,other,{assignedState:"Standby"});const items=materialize([],data.operations);
 data.view.scope=parent;data.view.hideCompleted=true;data.view.expanded=[];
 assert.deepEqual(workRows(items,data,{...emptyFilters(),status:"green"}).map(item=>item.id),[child]);
 data.view.search="Elsewhere";assert.equal(workRows(items,data,{...emptyFilters(),status:"green"}).length,0);assert.deepEqual(data.view.expanded,[]);
});

test("active filters honor matching parents' expansion while traversing hidden ancestors",()=>{
 const data=emptyWorkspace(),parent=createTask(data,null,"Matching parent"),child=createTask(data,parent,"Matching child");editTask(data,child,{assignedState:"Needs Testing",priority:"Major"});const items=materialize([],data.operations),filter={...emptyFilters(),status:"amber"};
 const rows=()=>workRows(items,data,filter).map(item=>item.id);
 assert.deepEqual(rows(),[parent]);data.view.expanded=[parent];assert.deepEqual(rows(),[parent,child]);data.view.expanded=[];assert.deepEqual(rows(),[parent]);
 data.view.search="Matching";assert.deepEqual(rows(),[parent]);data.view.expanded=[parent];assert.deepEqual(rows(),[parent,child]);data.view.expanded=[];
 assert.deepEqual(workRows(items,data,{...filter,priority:"Major"}).map(item=>item.id),[child]);
 data.view.search="";assert.deepEqual(workRows(items,data,emptyFilters()).map(item=>item.id),[parent]);
});
