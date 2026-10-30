import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path:string)=>readFileSync(new URL('../../src/'+path,import.meta.url),'utf8');
test("review banner is absent above trays; review information stays in Connection Details",()=>{
 assert.doesNotMatch(read('components/romdex/index.tsx'),/Review pending changes|reviewNotice/);
 assert.match(read('components/romdex/delivery-controls.tsx'),/reviewNotice/);
 assert.doesNotMatch(read('components/romdex/delivery-controls.tsx'),/Enable delivery for this session|Disconnect delivery/);
});
test("project and confirmation layouts provide explicit reset-independent gaps",()=>{
 const css=read('styles/romdex-desktop.css');assert.match(css,/\.project-selector-content\s*\{[^}]*gap:\s*12px/);
 assert.match(css,/\.port-check-line\s*\{[^}]*gap:\s*\.5rem/);
 for(const name of ['delivery-review','attachment-cache','migration','rdx-library'])assert.match(read('components/romdex/'+name+'.tsx'),/port-check-line/);
});
test("desktop dialogs explicitly restore native centering after the production reset",()=>{
 assert.match(read('styles/task-filters.css'),/dialog\.desktop-dialog\s*\{\s*margin:\s*auto/);
});
