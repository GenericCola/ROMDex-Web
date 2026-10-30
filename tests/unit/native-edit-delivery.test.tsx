import assert from "node:assert/strict";
import test from "node:test";
import { deliverQueue } from "../../src/cloud/delivery";
import { cloudData } from "../../src/cloud/types";
import { editTask } from "../../src/domain/task-actions";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { DeliveryClient } from "../../src/youtrack/delivery-client";
import {
  nativeFixtureFetch,
  rawIssue,
} from "../fixtures/native-field-delivery";
void test("native assignee/date delivery uses durable journal and verifies exact readback", async (t) => {
  const data = emptyWorkspace(),
    raw = rawIssue();
  let posts = 0;
  t.mock.method(
    globalThis,
    "fetch",
    nativeFixtureFetch(raw, (body) => {
      posts++;
      assert.equal(
        Object.values(cloudData(data).records)[0]?.status,
        "attempting",
      );
      assert.deepEqual(
        body.customFields.map((field) => {
          return field.id;
        }),
        ["f-user", "f-date", "f-period"],
      );
    }),
  );
  const port = new DeliveryClient("fixture-only");
  port.accountId = "fixture-user";
  const base = await port.get("PMON-1");
  assert.ok(base);
  data.remote = [base];
  editTask(data, "PMON-1", {
    assignee: "1-1",
    dueDate: "2026-10-30",
    "custom:f-period": 90,
  });
  await deliverQueue(
    () => {
      return data;
    },
    (update) => {
      update(data);
      return Promise.resolve();
    },
    port,
  );
  assert.equal(posts, 1);
  assert.equal(data.operations.length, 0);
  assert.equal(data.remote[0]?.assignee, "1-1");
  assert.equal(data.remote[0]?.dueDate, "2026-10-30");
  assert.equal(data.remote[0]?.["custom:f-period"], 90);
});
void test("native fields cannot dispatch without preparation", async (t) => {
  let writes = 0;
  t.mock.method(globalThis, "fetch", () => {
    writes++;
    throw Error("Unexpected network");
  });
  const port = new DeliveryClient("fixture-only");
  await assert.rejects(
    port.update("PMON-1", { dueDate: "2026-10-30" }),
    /fresh preparation/,
  );
  assert.equal(writes, 0);
});
void test("an ambiguous native-field POST stays held and cannot be automatically replayed", async (t) => {
  const raw = rawIssue(),
    data = emptyWorkspace();
  let posts = 0;
  t.mock.method(
    globalThis,
    "fetch",
    nativeFixtureFetch(raw, () => {
      posts++;
      throw Error("Response lost after fixture applied");
    }),
  );
  const port = new DeliveryClient("fixture-only");
  port.accountId = "fixture-user";
  const base = await port.get("PMON-1");
  assert.ok(base);
  data.remote = [base];
  editTask(data, "PMON-1", { dueDate: "2026-10-30" });
  const save = () => {
    return deliverQueue(
      () => {
        return data;
      },
      (update) => {
        update(data);
        return Promise.resolve();
      },
      port,
    );
  };
  await assert.rejects(save());
  assert.equal(Object.values(cloudData(data).records)[0]?.status, "uncertain");
  assert.equal(data.operations.length, 1);
  await assert.rejects(save(), /uncertain/);
  assert.equal(posts, 1);
});
void test("a native field changed after preparation blocks dispatch", async (t) => {
  const raw = rawIssue();
  let posts = 0;
  t.mock.method(
    globalThis,
    "fetch",
    nativeFixtureFetch(raw, () => {
      posts++;
    }),
  );
  const port = new DeliveryClient("fixture-only"),
    base = await port.get("PMON-1");
  assert.ok(base);
  const patch = { dueDate: "2026-10-30" };
  await port.prepareUpdate("PMON-1", patch, base);
  const date = raw.customFields.find((field) => {
    return field.id === "f-date";
  });
  assert.ok(date);
  date.value = Date.UTC(2026, 10, 1, 12);
  await assert.rejects(port.update("PMON-1", patch, base), /changed before/);
  assert.equal(posts, 0);
});
