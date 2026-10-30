import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { jsonObject } from "../../src/domain/json";
import { documentRevision, writeRdx } from "../../src/rdx/container";
import { inspectRdx } from "../../src/rdx/inspect";
import { planDocument } from "../fixtures/rdx";
void test("dedicated plan entry produces first-import review and retains exact source bytes", async () => {
  const bytes = await writeRdx(planDocument(), new Map());
  const result = await inspectRdx({ action: "inspect", bytes, planOnly: true });
  assert.equal(result.preview?.mode, "new");
  assert.equal((result.preview?.items as unknown[]).length, 1);
  assert.deepEqual(result.bytes, bytes);
  assert.equal(result.projection, null);
});
void test("dedicated plan entry refuses map content and agent results on their first import", async () => {
  const map = await readFile(
    new URL("../fixtures/native-map.rdx", import.meta.url),
  );
  await assert.rejects(
    inspectRdx({ action: "inspect", bytes: map, planOnly: true }),
    /NPCDex Map/,
  );
  const document = planDocument();
  jsonObject(document.origin).role = "agent-result";
  document.revision = documentRevision(document);
  await assert.rejects(
    writeRdx(document, new Map()),
    /Invalid RDX planDocument Structure/,
  );
});
