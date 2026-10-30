import assert from "node:assert/strict";
import test from "node:test";
import { readComments } from "../../src/youtrack/read-comments";
void test("all accessible native comments are paginated, validated and deleted entries excluded", async () => {
  const seen: number[] = [];
  const result = await readComments((route, method) => {
    assert.equal(method, undefined);
    assert.match(route, /^issues\/PMON-1\/comments\?/);
    const skip = Number(new URLSearchParams(route.split("?")[1]).get("$skip"));
    seen.push(skip);
    return Promise.resolve(
      skip === 0
        ? Array.from({ length: 100 }, (_, n) => {
            return {
              id: "4-" + n,
              text: "Synthetic " + n,
              created: n,
              deleted: n === 0,
              author: { login: "fixture" },
            };
          })
        : [
            {
              id: "4-100",
              text: "Last comment",
              created: 100,
              deleted: false,
              author: null,
            },
          ],
    );
  }, "PMON-1");
  assert.deepEqual(seen, [0, 100]);
  assert.equal(result.length, 100);
  assert.equal(result.at(-1)?.text, "Last comment");
});
void test("invalid and duplicate native comments fail closed rather than replace a cached list", async () => {
  await assert.rejects(
    readComments(() => {
      return Promise.resolve([
        { id: "4-1", text: "x", created: 1, deleted: false },
        { id: "4-1", text: "x", created: 1, deleted: false },
      ]);
    }, "PMON-1"),
    /inventory/,
  );
  await assert.rejects(
    readComments(() => {
      return Promise.resolve([{ id: "4-1", text: "x", created: 1 }]);
    }, "PMON-1"),
    /inventory/,
  );
  await assert.rejects(
    readComments(() => {
      return Promise.resolve([]);
    }, "NPCD-1"),
    /Only PMON/,
  );
});

void test("active Comments follows selected task without requiring another tab click", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL(
      "../../src/components/romdex/use-task-comments.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(source, /if \(!active\)/);
  assert.match(
    source,
    /if \(work\.busy \|\| loadedRef\.current === id\) return/,
  );
  assert.match(source, /loadedRef\.current = id;\s+load\(\)/);
  assert.match(source, /assertCurrent\(\);\s+const item = data\.remote/);
  const writing = await readFile(
    new URL("../../src/components/romdex/task-writing.tsx", import.meta.url),
    "utf8",
  );
  assert.match(writing, /useTaskComments\(item\.id, tab === "comments"\)/);
  assert.match(writing, /if \(tab === "comments"\) nativeComments\.load\(\)/);
});
