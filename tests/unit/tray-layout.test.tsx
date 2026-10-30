import assert from "node:assert/strict";
import test from "node:test";
import { trayKey } from "../../src/domain/tray-keyboard";
import {
  defaultTrayHeight,
  trayLayout,
  trayPosition,
} from "../../src/domain/tray-layout";
import { emptyWorkspace } from "../../src/domain/workspace-data";
void test("desktop split uses actual minimum and reserves Details without percentage clamps", () => {
  const view = emptyWorkspace().view;
  const layout = trayLayout(view, 1010, 350);
  assert.deepEqual(layout, {
    available: 1000,
    minimum: 350,
    maximum: 904,
    work: 460,
  });
  assert.equal(trayPosition(view, layout, 100).workHeight, 35);
  assert.equal(trayPosition(view, layout, 960).workHeight, 90.4);
  assert.equal(trayPosition(view, layout, 976).detailsMode, "collapsed");
  assert.equal(trayKey(view, "Home", false, 1010, layout)?.workHeight, 35);
});
void test("desktop minimum adapts to short viewports and collapsed arrows reopen from actual height", () => {
  const view = emptyWorkspace().view;
  assert.equal(trayLayout(view, 310, 350).minimum, 180);
  assert.equal(trayLayout(view, 310, 350).maximum, 225);
  assert.equal(trayLayout(view, 0).work, 0);
  assert.equal(
    trayKey({ ...view, detailsMode: "collapsed" }, "ArrowUp", false, 1010)
      ?.workHeight,
    90.4,
  );
});
void test("pointer cancellation restores initial layout and preserves grip offset", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL(
      "../../src/components/romdex/use-divider-pointer.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(source, /data\.view\.workHeight = active\.initial\.workHeight/);
  assert.match(
    source,
    /data\.view\.detailsMode = active\.initial\.detailsMode/,
  );
  assert.match(source, /window\.addEventListener\("blur", blur\)/);
  assert.match(source, /host\.getBoundingClientRect\(\)\.top - active\.offset/);
  const divider = await readFile(
    new URL("../../src/components/romdex/divider.tsx", import.meta.url),
    "utf8",
  );
  assert.match(divider, /onPointerCancel=\{cancel\}/);
  assert.match(divider, /onLostPointerCapture=\{cancel\}/);
});

void test("original automatic default adapts to viewport without rewriting an existing ratio", () => {
  const fresh = emptyWorkspace().view;
  assert.equal(fresh.automaticTrayHeight, true);
  assert.equal(defaultTrayHeight(650, 1200, 800), 254);
  assert.equal(defaultTrayHeight(650, 900, 800), 214);
  assert.equal(defaultTrayHeight(650, 390, 800), 280);
  assert.equal(defaultTrayHeight(250, 390, 400), 180);
  assert.equal(trayLayout(fresh, 650, 240, 254).work, 254);
  const existing = { ...fresh, workHeight: 63 };
  delete existing.automaticTrayHeight;
  assert.equal(trayLayout(existing, 650, 240, 254).work, 403.2);
  const moved = trayPosition(fresh, trayLayout(fresh, 650, 240, 254), 320);
  assert.equal(moved.automaticTrayHeight, false);
  assert.equal(trayLayout({ ...fresh, ...moved }, 650, 240, 254).work, 320);
});
