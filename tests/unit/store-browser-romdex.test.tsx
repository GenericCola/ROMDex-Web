import assert from "node:assert/strict";
import { test } from "node:test";
import type { WorkspaceData } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { romdexBinding } from "../../src/store/browser/romdex-binding";
import { taskItem as item } from "../fixtures/task-item";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const workspace = (): WorkspaceData => {
  const data = emptyWorkspace();
  data.remote = [item("PMON-1"), item("PMON-2"), item("PMON-3", "PMON-1")];
  return data;
};

test("ready needs tasks", () => {
  assert.equal(
    romdexBinding.ready(emptyWorkspace()),
    "Read YouTrack tasks first.",
  );
  assert.equal(romdexBinding.ready(workspace()), null);
});

test("local captures PMON images only and carries extras", () => {
  const data = workspace();
  data.images = { "PMON-1": PNG, scratch: PNG };
  const base = { "authorizations/PMON-9": { a: 1 } };
  const local = romdexBinding.local(data, base, {});
  assert.equal(local["image/PMON-1"], PNG);
  assert.equal("image/scratch" in local, false);
  assert.deepEqual(local["authorizations/PMON-9"], { a: 1 });
  const fresh = romdexBinding.local(data, null, base);
  assert.deepEqual(fresh["authorizations/PMON-9"], { a: 1 });
});

test("orders keep ids this browser does not know", () => {
  const data = workspace();
  data.order = { "PMON-2": 0, "PMON-1": 1 };
  const base = {
    "orders/ROOT": ["PMON-2", "PMON-8", "PMON-1"],
    "orders/PMON-7": ["PMON-70"],
  };
  const same = romdexBinding.local(data, base, {});
  assert.deepEqual(same["orders/ROOT"], ["PMON-2", "PMON-8", "PMON-1"]);
  assert.deepEqual(same["orders/PMON-7"], ["PMON-70"]);
  data.order = { "PMON-1": 0, "PMON-2": 1 };
  const moved = romdexBinding.local(data, base, {});
  assert.deepEqual(moved["orders/ROOT"], ["PMON-1", "PMON-2", "PMON-8"]);
});

test("pending hierarchy changes hold orders", () => {
  const data = workspace();
  data.order = { "PMON-1": 0, "PMON-2": 1 };
  data.operations = [
    {
      opId: "o",
      type: "edit",
      issueId: "PMON-2",
      base: item("PMON-2"),
      patch: { parentId: "PMON-1" },
    },
  ];
  const base = { "orders/ROOT": ["PMON-2", "PMON-1"] };
  assert.deepEqual(romdexBinding.local(data, base, {})["orders/ROOT"], [
    "PMON-2",
    "PMON-1",
  ]);
  const held = romdexBinding.apply(
    data,
    { "orders/ROOT": ["PMON-1", "PMON-2"] },
    ["orders/ROOT"],
    [],
  );
  assert.deepEqual(held, ["orders/ROOT"]);
  assert.deepEqual(data.order, { "PMON-1": 0, "PMON-2": 1 });
});

test("apply writes images and orders", () => {
  const data = workspace();
  data.images = { scratch: PNG, "PMON-2": PNG };
  const held = romdexBinding.apply(
    data,
    {
      "image/PMON-1": PNG,
      "image/scratch": "other",
      "orders/ROOT": ["PMON-2", "PMON-1"],
    },
    ["image/PMON-1", "image/PMON-2", "image/scratch", "orders/ROOT"],
    [],
  );
  assert.deepEqual(held, []);
  assert.deepEqual(Object.keys(data.images).sort(), ["PMON-1", "scratch"]);
  assert.equal(data.images["scratch"], PNG);
  assert.ok((data.order["PMON-2"] ?? 9) < (data.order["PMON-1"] ?? 0));
});

test("parts round trip local to remote", async () => {
  const data = workspace();
  data.images = { "PMON-1": PNG };
  data.order = { "PMON-2": 0, "PMON-1": 1 };
  const local = romdexBinding.local(data, null, {});
  const parts = await romdexBinding.parts(local, [], data);
  assert.deepEqual(romdexBinding.remote(parts), local);
});
