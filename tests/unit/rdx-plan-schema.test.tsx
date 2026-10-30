import assert from "node:assert/strict";
import test from "node:test";
import { readPlanSchema } from "../../src/youtrack/plan-schema";
void test("plan schema reads only the verified project and configured native bundles", async () => {
  const paths: string[] = [];
  const result = await readPlanSchema((route, method) => {
    assert.equal(method, undefined);
    paths.push(route);
    const path = route.split("?")[0];
    if (path === "admin/projects")
      return Promise.resolve([{ id: "0-1", shortName: "PMON" }]);
    if (path === "admin/projects/0-1/customFields")
      return Promise.resolve(
        ["State", "Priority", "Complexity", "Type"].map((name, index) => {
          return {
            id: "f-" + index,
            field: {
              name,
              fieldType: { id: index === 0 ? "state[1]" : "enum[1]" },
            },
          };
        }),
      );
    return Promise.resolve([
      {
        id: "v-1",
        name: path?.includes("f-0")
          ? "To do"
          : path?.includes("f-1")
            ? "Normal"
            : path?.includes("f-2")
              ? "MID"
              : "Task",
      },
    ]);
  });
  assert.deepEqual(result, {
    project: "PMON",
    projectId: "0-1",
    states: ["To do"],
    priorities: ["Normal"],
    types: ["Task"],
    complexity: { ready: true, options: ["MID"] },
  });
  assert.equal(paths.length, 6);
});
void test("ambiguous project identity never reaches field discovery", async () => {
  let calls = 0;
  await assert.rejects(
    readPlanSchema(() => {
      calls++;
      return Promise.resolve([
        { id: "0-1", shortName: "PMON" },
        { id: "0-2", shortName: "PMON" },
      ]);
    }),
    /Cannot verify/,
  );
  assert.equal(calls, 1);
});
