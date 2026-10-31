import { Buffer as BrowserBuffer } from "buffer/index.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { canonical } from "../../src/domain/accepted/content/contracts.mjs";
import { documentRevision, readRdx, writeRdx } from "../../src/rdx/container";
import { planDocument } from "../fixtures/rdx";

test("browser RDX framing round-trips the accepted plan schema and canonical revision", async () => {
  const document = planDocument(),
    bytes = await writeRdx(document, new Map()),
    result = await readRdx(bytes);
  assert.equal(result.document.revision, document.revision);
  assert.deepEqual(result.document, document);
  assert.equal(result.authorization, "not-established");
  assert.equal(result.blobs.size, 0);
  assert.equal(new TextDecoder().decode(bytes.subarray(0, 8)), "ROMDXR01");
});

test("browser RDX rejects trailing bytes, altered digests and unknown required capabilities", async () => {
  const bytes = await writeRdx(planDocument(), new Map());
  await assert.rejects(
    readRdx(Buffer.concat([bytes, Buffer.from([1])])),
    /Trailing|trailing/,
  );
  const broken = Uint8Array.from(bytes);
  const last = broken[broken.length - 1];
  assert.notEqual(last, undefined);
  if (last === undefined) throw Error("Expected encoded bytes");
  broken[broken.length - 1] = last ^ 1;
  await assert.rejects(readRdx(broken));
  const unsupported = planDocument();
  unsupported.capabilities = { required: ["org.romdex.future"], optional: [] };
  unsupported.revision = documentRevision(unsupported);
  await assert.rejects(
    writeRdx(unsupported, new Map()),
    /Unsupported Required/,
  );
});

test("raw DEFLATE entries reject extra compressed input rather than hiding unlisted data", async () => {
  const bytes = Buffer.from(await writeRdx(planDocument(), new Map())),
    size = bytes.readUInt32LE(8),
    manifest = JSON.parse(bytes.subarray(12, 12 + size).toString());
  assert.equal(manifest.entries[0].codec, "deflate-raw");
  manifest.entries[0].storedBytes++;
  const header = Buffer.from(canonical(manifest)),
    prefix = Buffer.alloc(12);
  prefix.write("ROMDXR01");
  prefix.writeUInt32LE(header.length, 8);
  const altered = Buffer.concat([
    prefix,
    header,
    bytes.subarray(12 + size),
    Buffer.from([37]),
  ]);
  await assert.rejects(readRdx(altered));
});

test("browser byte adapter keeps native Buffer inputs separate from the browser-compatible validator", async () => {
  assert.equal(BrowserBuffer.isBuffer(BrowserBuffer.from([1, 2])), true);
  const bytes = await writeRdx(planDocument(), new Map());
  assert.equal((await readRdx(Buffer.from(bytes))).document.kind, "plan");
});
