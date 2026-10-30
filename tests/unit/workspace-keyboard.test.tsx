import assert from "node:assert/strict";
import test from "node:test";
import {
  escapeAction,
  tabAction,
} from "../../src/domain/accepted/workspace-keyboard.mjs";
void test("desktop Tab selects the original inline, grouping and tray actions", () => {
  assert.equal(tabAction({ key: "Tab", inlineName: true }), "indent");
  assert.equal(
    tabAction({ key: "Tab", inlineName: true, shiftKey: true }),
    "outdent",
  );
  assert.equal(
    tabAction({ key: "Tab", navigation: true, selectedCount: 2 }),
    "group",
  );
  assert.equal(
    tabAction({ key: "Tab", navigation: true, selectedCount: 1 }),
    "cycle",
  );
  assert.equal(tabAction({ key: "Tab" }), null);
  assert.equal(
    tabAction({ key: "Tab", navigation: true, shiftKey: true }),
    null,
  );
  assert.equal(tabAction({ key: "g", navigation: true, ctrlKey: true }), null);
});
void test("desktop shortcuts leave modal, composition, modified and busy contexts alone", () => {
  for (const guard of [
    "modal",
    "isComposing",
    "ctrlKey",
    "altKey",
    "metaKey",
    "busy",
  ]) {
    assert.equal(
      tabAction({ key: "Tab", navigation: true, [guard]: true }),
      null,
    );
    assert.equal(
      escapeAction({ key: "Escape", hasSelection: true, [guard]: true }),
      null,
    );
  }
  assert.equal(escapeAction({ key: "Escape", hasSelection: true }), "clear");
  assert.equal(escapeAction({ key: "Escape", fieldFocused: true }), "clear");
  assert.equal(escapeAction({ key: "Escape" }), "toggle");
});

void test("divider original keys use pixel steps, collapse, and reopen without losing split", async () => {
  const { trayKey } = await import("../../src/domain/tray-keyboard");
  const { emptyWorkspace } = await import("../../src/domain/workspace-data");
  const { view } = emptyWorkspace();
  const up = trayKey(view, "ArrowUp", false, 1010);
  assert.equal(up?.workHeight, 43.6);
  assert.equal(trayKey(view, "ArrowDown", true, 1010)?.workHeight, 54);
  assert.equal(trayKey(view, "End", false, 1010)?.detailsMode, "collapsed");
  assert.equal(
    trayKey({ ...view, detailsMode: "collapsed" }, "Enter", false, 1010)
      ?.detailsMode,
    "default",
  );
  assert.equal(trayKey(view, "Home", false, 1010)?.workHeight, 24);
  assert.equal(trayKey(view, "x", false, 1010), null);
});

void test("Escape flushes Details title, cancels inline naming and preserves comments", async () => {
  const { clearWorkspaceFocus } =
    await import("../../src/domain/clear-workspace-focus");
  const { emptyWorkspace } = await import("../../src/domain/workspace-data");
  const { createTask } = await import("../../src/domain/task-actions");
  const { materialize } = await import("../../src/domain/accepted/core.mjs");
  const data = emptyWorkspace(),
    id = createTask(data, null, "Original");
  data.view.selected = id;
  data.titleDrafts[id] = "Changed title";
  data.commentDrafts[id] = "Unposted comment";
  clearWorkspaceFocus(data);
  assert.equal(
    materialize(data.remote, data.operations)[0]?.summary,
    "Changed title",
  );
  assert.equal(data.commentDrafts[id], "Unposted comment");
  assert.equal(data.view.selected, null);
  data.view.selected = id;
  data.view.renameId = id;
  data.titleDrafts[id] = "Cancel inline text";
  clearWorkspaceFocus(data);
  assert.equal(
    materialize(data.remote, data.operations)[0]?.summary,
    "Changed title",
  );
  assert.equal(data.titleDrafts[id], undefined);
  data.view.selected = id;
  data.titleDrafts[id] = "  ";
  clearWorkspaceFocus(data);
  assert.equal(
    materialize(data.remote, data.operations)[0]?.summary,
    "Changed title",
  );
});

void test("multiple checked rows remain grouping navigation while single checkbox keeps normal Tab", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../../src/components/romdex/work-trays.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /target.matches\("\.row-check"\) && selection.selection.ids.length > 1/,
  );
  assert.equal(
    tabAction({ key: "Tab", navigation: true, selectedCount: 2 }),
    "group",
  );
  assert.equal(
    tabAction({ key: "Tab", navigation: false, selectedCount: 1 }),
    null,
  );
});
