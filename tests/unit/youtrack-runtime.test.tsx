import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

test("acceptance modules load without Node module globals and retain guards and failure rollback signals", async () => {
  const { acceptanceSources } =
    await import("../../scripts/youtrack-acceptance.mjs");
  const files: Map<string, string> = await acceptanceSources(
    JSON.parse(readFileSync("youtrack-app/manifest.json", "utf8")),
  );
  for (const name of ["status-record.js", "status-rules.js"])
    assert.doesNotThrow(() =>
      runInNewContext(
        readFileSync("youtrack-app/" + name, "utf8"),
        { exports: {} },
        { filename: name },
      ),
    );
  const logs: string[] = [],
    cache = new Map<string, Record<string, unknown>>();
  const load = (name: string): Record<string, unknown> => {
    const key = name.replace(/^\.\//, "") + ".js";
    const found = cache.get(key);
    if (found) return found;
    const value = {};
    cache.set(key, value);
    runInNewContext(
      files.get(key) ?? readFileSync("youtrack-app/" + key, "utf8"),
      {
        exports: value,
        require: load,
        console: { error: (message: string) => logs.push(message) },
      },
      { filename: key },
    );
    return value;
  };
  type Endpoint = { method: string; handle: (ctx: unknown) => void };
  const handler = load("./status").httpHandler as { endpoints: Endpoint[] };
  const read = handler.endpoints.find(
    (endpoint) => endpoint.method === "GET",
  )!.handle;
  const issue = {
    id: "NPCD-872",
    summary: "[ROMDex acceptance] Root",
    updated: 1,
    isReported: true,
    isVisibleTo: () => true,
    project: {
      shortName: "NPCD",
      findFieldByName: () => ({
        typeName: "state[1]",
        isVisibleInIssue: () => true,
        values: [{ name: "Open" }],
      }),
    },
    fields: {
      canBeReadBy: () => true,
      canBeWrittenBy: () => true,
      State: { name: "Done" },
    },
    extensionProperties: { assignedStatus: null as string | null },
  };
  let result: unknown;
  const response = {
    code: 200,
    addHeader: () => {},
    json: (value: unknown) => {
      result = value;
    },
  };
  read({ issue, currentUser: {}, response });
  assert.equal(response.code, 200);
  assert.equal((result as { initialized: boolean }).initialized, false);
  assert.equal(issue.extensionProperties.assignedStatus, null);
  assert.equal(logs.length, 0);
  read({ issue: { ...issue, id: "NPCD-999" }, currentUser: {}, response });
  assert.equal(response.code, 403);
  assert.equal(logs.length, 0);
  assert.throws(
    () =>
      read({
        issue: {
          ...issue,
          project: {
            ...issue.project,
            findFieldByName: () => {
              throw Error("synthetic API failure");
            },
          },
        },
        currentUser: {},
        response,
      }),
    /synthetic API failure/,
  );
  assert.match(
    logs.pop()!,
    /ROMDex acceptance status failure:.*synthetic API failure/s,
  );
  assert.equal(issue.fields.State.name, "Done");
  assert.equal(issue.extensionProperties.assignedStatus, null);
  assert.throws(
    () =>
      runInNewContext(files.get("status.js")!, {
        exports: {},
        require: () => {
          throw Error("synthetic import failure");
        },
        console: { error: (message: string) => logs.push(message) },
      }),
    /synthetic import failure/,
  );
  assert.match(
    logs.pop()!,
    /ROMDex acceptance module load failure:.*synthetic import failure/s,
  );
  issue.extensionProperties.assignedStatus = JSON.stringify({
    schema: 1,
    revision: 1,
    assignedState: "Done",
    lastState: "Done",
    receipt: {
      schema: 1,
      opId: "before",
      kind: "assign",
      value: "Done",
      expected: {
        revision: 0,
        initialized: false,
        assignedState: "Done",
        state: "Done",
        updated: 1,
      },
    },
  });
  const fault = load("./fault").httpHandler as { endpoints: Endpoint[] };
  assert.throws(
    () =>
      fault.endpoints[0]!.handle({
        issue,
        currentUser: {},
        response,
        request: {
          json: () => ({
            schema: 1,
            opId: "00000000-0000-4000-8000-000000000000",
          }),
        },
      }),
    /ROMDex acceptance forced rollback/,
  );
  assert.equal(
    logs.pop(),
    "ROMDex acceptance forced rollback 00000000-0000-4000-8000-000000000000",
  );
  assert.equal(issue.fields.State.name, "Open");
  assert.equal(
    issue.extensionProperties.assignedStatus,
    "forced-rollback-must-not-persist",
  );
  // This VM has no transaction engine: native rollback remains a live acceptance check.
});
