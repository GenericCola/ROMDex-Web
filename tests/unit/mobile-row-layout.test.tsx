import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
void test("phone row compacting is scoped and leaves desktop hierarchy/control rules intact", async () => {
  const css = await readFile(
    new URL("../../src/styles/romdex-desktop.css", import.meta.url),
    "utf8",
  );
  const marker = "/* Phone rows retain every control";
  const index = css.indexOf(marker);
  assert.ok(index > 0);
  const desktop = css.slice(0, index),
    mobile = css.slice(index);
  assert.match(desktop, /--row-gutter:48px/);
  assert.match(desktop, /--hierarchy-step:21px/);
  assert.match(mobile, /@scope \(\.romdex-app\)/);
  assert.match(mobile, /@media \(max-width: 550px\)/);
  assert.match(mobile, /--row-gutter: 28px/);
  assert.match(mobile, /--hierarchy-step: 16px/);
  assert.match(mobile, /\.row-check \{ opacity: 1/);
  assert.doesNotMatch(
    mobile,
    /display:\s*none|position:\s*absolute|overflow:\s*hidden/,
  );
});

test("Tray 1 smaller triangle retains independent hit area and expanded-state rotation", () => {
  const css = readFileSync("src/styles/romdex-desktop.css", "utf8");
  assert.match(css, /\.selector-expand span\{display:block;font-size:12px/);
  assert.match(css, /\.selector-expand\{[^}]*width:24px;height:24px/);
  assert.match(css, /\.selector-expand\[aria-expanded=true\] span\{transform:rotate\(90deg\)/);
});
