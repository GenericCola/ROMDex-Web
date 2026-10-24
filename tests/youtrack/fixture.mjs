import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {runInNewContext} from "node:vm";
import {buildYouTrackArchive} from "../../scripts/package-youtrack.mjs";

export const archive = await buildYouTrackArchive({acceptance: true});
export const archiveFiles = new Map();
let offset = 0;
while (archive.zip.readUInt32LE(offset) === 0x04034b50) {
  const size = archive.zip.readUInt32LE(offset + 18), length = archive.zip.readUInt16LE(offset + 26);
  const name = archive.zip.subarray(offset + 30, offset + 30 + length).toString();
  archiveFiles.set(name, archive.zip.subarray(offset + 30 + length, offset + 30 + length + size).toString());
  offset += 30 + length + size;
}
const strict = (name, object) => new Proxy(object, {
  get(target, key, receiver) {
    if (typeof key === "string" && !(key in target)) throw Error("Undocumented fixture API: " + name + "." + key);
    return Reflect.get(target, key, receiver);
  },
});
const nativeSet = (values) => strict("Set", {
  find: (predicate) => values().find(predicate),
  forEach: (visitor) => values().forEach(visitor),
  isEmpty: () => values().length === 0,
});
export const createBackend = ({statusSource} = {}) => {
  const tasks = new Map([
    ["NPCD-872", {id:"NPCD-872", state:"Open", summary:"[ROMDex acceptance] Root", updated:1, parent:null}],
    ["NPCD-873", {id:"NPCD-873", state:"Done", summary:"[ROMDex acceptance] Child", updated:1, parent:"NPCD-872"}],
  ]);
  const logs = [], requests = [], commits = [];
  const options = {readable:true, writable:true, fieldReadable:true, fieldWritable:true, fieldVisible:true, fieldType:"state[1]", missingState:false, throwAfterState:false, throwOnRead:false};
  const cache = new Map();
  const load = (name) => {
    const key = name.replace(/^\.\//, "") + ".js";
    if (cache.has(key)) return cache.get(key);
    const value = {}; cache.set(key,value);
    assert.ok(archiveFiles.has(key), "Only archive-local imports are allowed: " + key);
    runInNewContext(key === "status.js" && statusSource ? statusSource : archiveFiles.get(key), {exports:value,require:load,console:{error:(message)=>logs.push(String(message))}}, {filename:key,timeout:1000});
    return value;
  };
  const wrappers = (id, draft) => {
    const task = draft.get(id);
    if (!task) return null;
    const states = ["Open","In Progress","In Review","On hold","Done","Canceled"].filter((name)=>!options.missingState || name!=="In Progress");
    const field = strict("BundleProjectCustomField", {typeName:options.fieldType,values:nativeSet(()=>states.map((name)=>({name}))),isVisibleInIssue:()=>options.fieldVisible});
    const fields = strict("Fields", {
      canBeReadBy:(name)=>{assert.equal(name,"State");return options.fieldReadable;},
      canBeWrittenBy:(name)=>{assert.equal(name,"State");return options.fieldWritable;},
      get State(){if(options.throwOnRead)throw Error("synthetic read failure");return {name:task.state};},
      set State(value){assert.ok(states.includes(value.name));task.state=value.name;if(options.throwAfterState)throw Error("synthetic workflow failure");},
    });
    return strict("Issue", {
      id:task.id, summary:task.summary, updated:task.updated, isReported:true,
      isVisibleTo:()=>options.readable,
      project:strict("Project", {shortName:"NPCD",canBeReadBy:(name)=>{throw Error("Cannot resolve property Project."+name);},canBeWrittenBy:(name)=>{throw Error("Cannot resolve property Project."+name);},findFieldByName:()=>field}),
      fields,
      extensionProperties:strict("ExtensionProperties", {get assignedStatus(){return task.metadata??null;},set assignedStatus(value){task.metadata=value;}}),
      links:strict("Links", {"parent for":nativeSet(()=>[...draft.values()].filter((child)=>child.parent===id).map((child)=>wrappers(child.id,draft)))}),
    });
  };
  const dispatch = (path, params, id="NPCD-872") => {
    assert.ok(params && typeof params.scope === "boolean", "Deployed SDK requires explicit scope options");
    const [script, endpointPath] = path.split("/");
    const method = params.method??"GET";
    requests.push({path,method,id,body:structuredClone(params.body)});
    const endpoint = load("./"+script).httpHandler.endpoints.find((entry)=>entry.method===method && entry.path===endpointPath);
    assert.ok(endpoint,"Archive handler route exists");
    assert.equal(params.scope,endpoint.scope==="issue");
    if (!options.readable || (method==="POST" && !options.writable)) return {status:403,body:null};
    const draft = structuredClone(tasks);let responseBody=null;
    let rawBody=params.body===undefined?"":JSON.stringify(params.body);
    const takeBody=()=>{const value=rawBody;rawBody="";return value;};
    const response = strict("HttpResponse",{code:200,addHeader:(name,value)=>assert.equal(value,"no-store"),json:(value)=>{responseBody=structuredClone(value);}});
    try {
      endpoint.handle({issue:params.scope?wrappers(id,draft):undefined,currentUser:{login:"fixture-owner"},request:{get body(){return takeBody();},json:()=>JSON.parse(takeBody())},response});
      if (response.code<400) {
        for (const [key,task] of draft) if (JSON.stringify(task)!==JSON.stringify(tasks.get(key))) {
          assert.equal(method,"POST","GET cannot initialize or mutate storage");
          task.updated++; tasks.set(key,task);commits.push(key);
        }
      }
      return {status:response.code,body:responseBody};
    } catch (error) {
      // Only a transaction stand-in: no draft changes commit on an escaped exception.
      return {status:500,body:null,error};
    }
  };
  const host = (id="NPCD-872") => {
    const send = async (path,params,target=id) => {
      if(params?.method === "POST")assert.equal(params.headers?.["Content-Type"],"application/json","Widget writes explicitly declare JSON content");
      const result = dispatch(path,params,target);
      if (result.status>=400) throw {status:result.status,message:result.body?.error??""};
      return result.body;
    };
    return {
      fetchApp:send,
      fetchYouTrack:async(path)=>{
        assert.equal(path,"issues/NPCD-873/extensionEndpoints/romdex-status-acceptance/status/assigned");
        return send("status/assigned",{scope:true},"NPCD-873");
      },
    };
  };
  return {tasks,logs,requests,commits,options,dispatch,host,load};
};
export const mountPanel = async (backend, {id="NPCD-872", registerError, host=backend.host(id), source=archiveFiles.get("widgets/acceptance/panel.js")}={}) => {
  const nodes={result:{textContent:""},read:{disabled:true},run:{disabled:true},rollback:{disabled:true}};
  const document={getElementById:(name)=>nodes[name],querySelectorAll:()=>[nodes.read,nodes.run,nodes.rollback]};
  const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
  await new AsyncFunction("YTApp","document","crypto",source)(
    {register:async()=>{if(registerError!==undefined)throw registerError;return host;}},document,crypto);
  const click = async(name)=>{assert.equal(nodes[name].disabled,false);await nodes[name].onclick();return nodes.result.textContent;};
  return {nodes,click,host};
};
