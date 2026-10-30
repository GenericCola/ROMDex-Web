import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "../../src/domain/json";
import { readEditOptions } from "../../src/youtrack/edit-options";
import { nativeEditPayload } from "../../src/youtrack/native-edit-payload";
const field = (id: string, name: string, type: string) => {
  return {
    id,
    canBeEmpty: true,
    field: { id: "global-" + id, name, fieldType: { id: type } },
    bundle: { id: "8-1" },
  };
};
const fixture = async (denyTracking = false) => {
  return readEditOptions((route, method) => {
    assert.equal(method, undefined);
    const path = route.split("?")[0];
    if (path === "admin/projects")
      return Promise.resolve([{ id: "0-1", shortName: "PMON" }]);
    if (path?.endsWith("/customFields"))
      return Promise.resolve([
        field("f-1", "Assignee", "user[1]"),
        field("f-2", "Due Date", "date"),
        field("f-3", "Estimate", "period"),
        field("f-4", "Renamed Logged Time", "period"),
        field("f-5", "Choice", "enum[1]"),
      ]);
    if (path?.endsWith("/aggregatedUsers"))
      return Promise.resolve([
        { id: "1-1", login: "fixture", name: "Fixture" },
      ]);
    if (path?.endsWith("/bundle/values"))
      return Promise.resolve([{ id: "5-1", name: "First" }]);
    if (path?.endsWith("/timeTrackingSettings"))
      return denyTracking
        ? Promise.reject(Error("Unavailable"))
        : Promise.resolve({ enabled: true, timeSpent: { id: "f-4" } });
    throw Error("Unexpected read route");
  }, "0-1");
};
void test("native field discovery preserves calculated period restrictions and exact eligible users", async () => {
  const result = await fixture();
  const { options } = result;
  assert.equal((options.assignee as JsonObject).ready, true);
  const custom = options.custom as JsonObject[];
  assert.equal(
    custom.find((def) => {
      return def.id === "f-4";
    })?.readOnly,
    true,
  );
  assert.equal(
    custom.find((def) => {
      return def.id === "f-3";
    })?.readOnly,
    false,
  );
  assert.equal((options.tags as JsonObject).ready, false);
  const payload = nativeEditPayload(
    {
      assignee: "1-1",
      dueDate: "2026-10-30",
      "custom:f-3": 90,
      "custom:f-5": "5-1",
    },
    options,
  );
  assert.deepEqual(
    payload.map((value) => {
      return value.value;
    }),
    [{ id: "1-1" }, Date.UTC(2026, 9, 30, 12), { minutes: 90 }, { id: "5-1" }],
  );
  assert.throws(() => {
    return nativeEditPayload({ assignee: "other" }, options);
  }, /eligible/);
  assert.throws(() => {
    return nativeEditPayload({ "custom:f-4": 90 }, options);
  }, /Calculated/);
  assert.throws(() => {
    return nativeEditPayload({ "custom:f-5": "missing" }, options);
  }, /Configured/);
  assert.throws(() => {
    return nativeEditPayload({ dueDate: "2026-10-30" }, options, [
      { id: "f-2", name: "Due Date", $type: "SimpleIssueCustomField" },
    ]);
  }, /configuration changed/);
});
void test("unreadable time tracking designation gates every period, not just a familiar field name", async () => {
  const { options } = await fixture(true);
  assert.throws(() => {
    return nativeEditPayload({ "custom:f-3": 90 }, options);
  }, /designation/);
});
