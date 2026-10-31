import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import SyncRecoveryPanel from "../../src/components/romdex/sync-recovery-panel";
import { workspaceStore } from "../../src/domain/workspace-store";
const render = (
  count: number,
  reviews = 0,
  move = false,
  rollupPending = false,
  connection = "Synthetic error",
) => {
  const data = structuredClone(workspaceStore.getSnapshot().data);
  data.cloud = { autoSync: true, records: {}, rollupPending };
  data.operations = Array.from({ length: count }, (_, index) => ({
    type: "comment" as const,
    opId: `op-${index}`,
    issueId: `PMON-${500 + index}`,
    text: "private comment",
    created: 1,
  }));
  if (move)
    data.operations = [
      {
        type: "edit",
        opId: "move",
        issueId: "PMON-500",
        base: {} as never,
        patch: { parentId: "PMON-501" },
      },
    ];
  let calls = 0;
  const html = renderToStaticMarkup(
    <SyncRecoveryPanel
      data={data}
      connection={connection}
      reviews={reviews}
      connected
      busy={false}
      retry={() => {
        calls++;
      }}
    />,
  );
  assert.equal(calls, 0);
  assert.doesNotMatch(html, /private comment/);
  return html;
};
test("single and multiple changes show bounded summaries and explicit save labels", () => {
  assert.match(render(1), /Your choice is ready to save to YouTrack/);
  assert.match(render(1), />SAVE CHANGE</);
  const multi = render(7);
  assert.match(multi, />SAVE 7 CHANGES</);
  assert.equal((multi.match(/<li>/g) ?? []).length, 5);
  assert.match(multi, /2 more changes are included/);
  assert.match(multi, /<details><summary>Connection details/);
  assert.doesNotMatch(multi, /<details open/);
});
test("unresolved reviews and task moves never expose Save", () => {
  assert.doesNotMatch(render(1, 1), />SAVE/);
  assert.doesNotMatch(render(1, 0, true), />SAVE/);
});
test("empty queue does not claim a choice is ready or offer Save", () => {
  const html = render(0);
  assert.match(html, /No changes to save/);
  assert.doesNotMatch(html, /ready to save|>SAVE/);
});

test("status-only pending remains actionable but unknown records still block Save", () => {
  const html = render(0, 0, false, true);
  assert.match(html, /parent status updates still need to finish/);
  assert.match(html, />SAVE STATUS UPDATES</);
  assert.doesNotMatch(html, /No changes to save|Nothing is waiting/);
  const uncertain = render(0, 1, false, true);
  assert.match(uncertain, /Resolve the changes below/);
  assert.doesNotMatch(uncertain, />SAVE|Ticket changes saved/);
});

test("latest save failure is visible rather than hidden or called ready", () => {
  const html = render(
    1,
    0,
    false,
    false,
    "Save stopped: YouTrack could not be reached.",
  );
  assert.match(html, /role="alert">YouTrack could not be reached/);
  assert.doesNotMatch(html, /Ready to save|choice is ready|<details>/);
  assert.match(html, />SAVE CHANGE</);
});
