import assert from "node:assert/strict";
import test from "node:test";
import { createRowOpenQueue } from "../../src/components/romdex/row-open-queue";

// PMON-639: Save pressed within 220 ms of a row click used to drop the selection.
void test("pressing Save opens the pending row at once instead of dropping it", () => {
  const timers = new Set<() => void>(),
    commits = new Set<() => void>(),
    events: string[] = [];
  const queue = createRowOpenQueue({
    after: (callback) => {
      timers.add(callback);
      return () => {
        timers.delete(callback);
      };
    },
    interrupt: (_cancel, commit) => {
      commits.add(commit);
      return () => {
        commits.delete(commit);
      };
    },
  });
  const save = () => {
    for (const commit of [...commits]) commit();
  };
  let allowed = true;
  const isAllowed = () => {
    return allowed;
  };
  queue.schedule(Symbol(), isAllowed, () => {
    events.push("row");
  });
  save();
  assert.deepEqual(events, ["row"]);
  assert.equal(commits.size, 0);
  assert.equal(
    timers.size,
    0,
    "the 220 ms timer is gone, so it never runs twice",
  );
  allowed = false;
  queue.schedule(Symbol(), isAllowed, () => {
    events.push("stale");
  });
  save();
  assert.deepEqual(events, ["row"], "the context recheck still applies");
});
