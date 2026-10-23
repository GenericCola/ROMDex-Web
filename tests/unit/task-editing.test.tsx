import {test} from "node:test";
import assert from "node:assert/strict";
import {setTaskTextEditing,hasTaskTextEditing} from "../../src/domain/task-editing";
import {saveNeedsAttention} from "../../src/domain/accepted/core.mjs";
test("text editing holds are independent, release cleanly, and unsent desktop notes keep the save indicator on",()=>{
 assert.equal(hasTaskTextEditing(),false);setTaskTextEditing("task:notes",true);setTaskTextEditing("other:title",true);setTaskTextEditing("task:notes",false);assert.equal(hasTaskTextEditing(),true);setTaskTextEditing("other:title",false);assert.equal(hasTaskTextEditing(),false);
 assert.equal(saveNeedsAttention({operations:[{type:"edit"}]},{connected:true,automaticSyncEnabled:true,mode:"editing"}),true);assert.equal(saveNeedsAttention({operations:[]},{connected:true,automaticSyncEnabled:true,mode:"editing"}),false);
});