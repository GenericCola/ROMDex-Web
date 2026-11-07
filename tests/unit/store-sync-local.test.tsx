import assert from "node:assert/strict";
import { test } from "node:test";
import { romdexBinding } from "../../src/store/browser/romdex-binding";
import { syncStore } from "../../src/store/browser/sync";
import { device, twoArticles, withIdb } from "../fixtures/store-sync-setup";

test("a sync started by a local change sends nothing when no synced value changed", () => {
  return withIdb(async () => {
    const { fake } = await twoArticles();
    const a = device("a");
    a.snapshot.data.order = { "PMON-4": 0, "PMON-3": 1, "PMON-2": 2 };
    assert.equal((await syncStore(a.deps(fake), romdexBinding)).kind, "synced");
    const before = fake.calls.length;
    a.snapshot.data.commentDrafts["PMON-2"] = "not a synced value";
    const quiet = await syncStore(a.deps(fake), romdexBinding, true);
    assert.equal(quiet.kind, "synced");
    assert.equal(fake.calls.length, before, "no YouTrack request");
    a.snapshot.data.order = { "PMON-2": 0, "PMON-3": 1, "PMON-4": 2 };
    const sent = await syncStore(a.deps(fake), romdexBinding, true);
    assert.equal(sent.kind === "synced" && sent.written, true);
    assert.ok(fake.calls.length > before);
  });
});
