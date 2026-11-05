import assert from "node:assert/strict";
import test from "node:test";
import { finishExpiredSession } from "../../src/components/romdex/finish-expired-session";
import { workspaceStore } from "../../src/domain/workspace-store";

test("expiry permits renewal only after local recovery flush succeeds", async (t) => {
  let delivering = true,
    clears = 0;
  const snapshot = workspaceStore.getSnapshot();
  t.mock.method(workspaceStore, "getSnapshot", () => ({
    ...snapshot,
    ready: false,
    delivering,
  }));
  const blocks: boolean[] = [];
  const finish = () =>
    finishExpiredSession(
      () => {},
      (blocked) => {
        blocks.push(blocked);
      },
      () => {},
      () => {
        clears++;
      },
    );
  assert.equal(await finish(), false);
  assert.deepEqual(blocks, [true]);
  assert.equal(clears, 0);
  delivering = false;
  assert.equal(await finish(), true);
  assert.deepEqual(blocks, [true, false]);
  assert.equal(clears, 1);
});
