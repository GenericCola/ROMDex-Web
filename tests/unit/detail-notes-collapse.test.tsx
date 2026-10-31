import assert from "node:assert/strict";
import test from "node:test";
import { selectDetailView } from "../../src/components/romdex/detail-navigation-presentation";
import { emptyWorkspace } from "../../src/domain/workspace-data";

void test("Notes selects another task without reopening or focusing collapsed Details", () => {
  const { view } = emptyWorkspace();
  view.detailsMode = "collapsed";
  view.selected = "PMON-1";
  assert.equal(selectDetailView(view, "PMON-2", true), false);
  assert.equal(view.selected, "PMON-2");
  assert.equal(view.detailsMode, "collapsed");
  assert.equal(selectDetailView(view, "PMON-3"), false);
  assert.equal(view.selected, "PMON-3");
  assert.equal(view.detailsMode, "default");
});

void test("Notes focuses an already visible tray without changing its layout", () => {
  const { view } = emptyWorkspace();
  for (const mode of ["default", "expanded"] as const) {
    view.detailsMode = mode;
    assert.equal(selectDetailView(view, "PMON-2", true), true);
    assert.equal(view.detailsMode, mode);
    assert.equal(view.selected, "PMON-2");
  }
});
