import {test} from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {crc32} from "node:zlib";
test("installable app ZIP contains only the exact backend sources with valid CRCs and deterministic checksum",()=>{
  execFileSync(process.execPath,["scripts/package-youtrack.mjs"],{stdio:"pipe"});const path="artifacts/romdex-status-1.0.0.zip",zip=readFileSync(path);let at=0;const names:string[]=[];
  while(zip.readUInt32LE(at)===0x04034b50){assert.equal(zip.readUInt16LE(at+8),0);const size=zip.readUInt32LE(at+18),length=zip.readUInt16LE(at+26),name=zip.subarray(at+30,at+30+length).toString();names.push(name);const bytes=zip.subarray(at+30+length,at+30+length+size);assert.equal(crc32(bytes),zip.readUInt32LE(at+14));assert.deepEqual(bytes,readFileSync("youtrack-app/"+name));at+=30+length+size;}
  assert.deepEqual(names,["manifest.json","entity-extensions.json","status.js","status-record.js","status-rules.js"]);assert.equal(zip.readUInt32LE(at),0x02014b50);assert.equal(zip.readUInt32LE(zip.length-22),0x06054b50);assert.equal(zip.readUInt16LE(zip.length-12),5);const sum=createHash("sha256").update(zip).digest("hex");assert.equal(readFileSync(path+".sha256","utf8").split(" ")[0],sum);execFileSync(process.execPath,["scripts/package-youtrack.mjs"],{stdio:"pipe"});assert.deepEqual(readFileSync(path),zip);
});
