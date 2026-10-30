import assert from "node:assert/strict";
import test from "node:test";
import { readTagChoices, TagClient } from "../../src/youtrack/tags";
void test("native tag adapter addresses only existing issue-tag links and requires exact add receipt", async () => {
  const calls: { path: string; method: string; body: unknown }[] = [];
  const client = new TagClient(async (path, method = "GET", body) => {
    await Promise.resolve();
    calls.push({ path, method, body });
    return method === "POST" ? { id: "146-2" } : null;
  });
  await client.add("PMON-1", "146-2");
  await client.remove("PMON-1", "146-2");
  assert.deepEqual(
    calls.map((x) => {
      return [x.path, x.method];
    }),
    [
      ["issues/PMON-1/tags?fields=id", "POST"],
      ["issues/PMON-1/tags/146-2", "DELETE"],
    ],
  );
  assert.deepEqual(calls[0]?.body, { id: "146-2" });
  await assert.rejects(client.add("NPCD-1", "146-2"), /Only PMON/);
  await assert.rejects(client.remove("PMON-1", "../146-2"), /Invalid tag/);
  const malformed = new TagClient(async () => {
    await Promise.resolve();
    return {};
  });
  await assert.rejects(malformed.add("PMON-1", "146-2"), /exact receipt/);
});
void test("tag inventories paginate fully and reject duplicate identities", async () => {
  const pages: number[] = [];
  const client = new TagClient(async (path) => {
    await Promise.resolve();
    const skip = Number(
      new URL(path, "https://fixture.invalid/").searchParams.get("$skip"),
    );
    pages.push(skip);
    return Array.from({ length: skip === 0 ? 100 : 1 }, (_, n) => {
      return { id: `146-${skip + n}` };
    });
  });
  assert.equal((await client.list("PMON-1")).length, 101);
  assert.deepEqual(pages, [0, 100]);
  await assert.rejects(
    readTagChoices(async () => {
      await Promise.resolve();
      return [
        { id: "146-1", name: "One" },
        { id: "146-1", name: "Duplicate" },
      ];
    }),
    /Invalid tag/,
  );
});

void test("tag choices permit preserving existing unknown IDs but never unknown additions", async () => {
  const { validateTagSelection } = await import("../../src/cloud/tag-types");
  assert.deepEqual(
    validateTagSelection(["146-9"], ["146-9"], { ready: true, options: [] }),
    ["146-9"],
  );
  assert.throws(() => {
    validateTagSelection(["146-9"], [], { ready: true, options: [] });
  }, /existing available/);
  assert.throws(() => {
    validateTagSelection([], [], { ready: false, options: [] });
  }, /unavailable/);
});
