import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ConnectionIndicator from "../../src/components/romdex/connection-indicator";
import {
  completedControl,
  connectionIndicator,
} from "../../src/components/romdex/indicator-status";
test("desktop connection parity: blue healthy, dark-blue disabled, red unavailable or paused", () => {
  assert.deepEqual(connectionIndicator(true, true, false), {
    color: "blue",
    label: "YouTrack Connection Is Healthy",
  });
  for (const connected of [false, true])
    for (const paused of [false, true])
      assert.deepEqual(connectionIndicator(connected, false, paused), {
        color: "dark-blue",
        label: "Auto-Sync Data Is Off",
      });
  for (const paused of [false, true])
    assert.deepEqual(connectionIndicator(false, true, paused), {
      color: "red",
      label: "Connect to YouTrack",
    });
  assert.equal(connectionIndicator(true, true, true).color, "red");
  assert.match(connectionIndicator(true, true, true).label, /Paused/);
});
test("connecting is not presented as verified healthy; successful verification restores blue", () => {
  const stages = [false, false, true, false].map(
    (connected) => connectionIndicator(connected, true, false).color,
  );
  assert.deepEqual(stages, ["red", "red", "blue", "red"]);
});
test("connection lens has specific readable status and no side effects; Save semantics stay independent", () => {
  let opened = 0;
  const html = renderToStaticMarkup(
    <ConnectionIndicator
      connected
      enabled
      paused={false}
      open={() => {
        opened++;
      }}
    />,
  );
  assert.match(html, /class="bulb blue"/);
  assert.match(html, /Connection Details · YouTrack Connection Is Healthy/);
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /Not Started|In Progress|yellow|green/);
  assert.equal(opened, 0);
  const header = readFileSync("src/components/romdex/header.tsx", "utf8");
  const save = readFileSync("src/components/romdex/header-status.ts", "utf8");
  assert.match(header, /color=\{indicator.color\}/);
  assert.match(save, /state\.error \|\| attention \|\| overdue \? "red"/);
  assert.match(save, /: "green"/);
  assert.doesNotMatch(
    header,
    /state\.connection === "Not connected" \? "blue" : "yellow"/,
  );
});

test("Hide Completed matches desktop red hidden and grey visible without task-status labels", () => {
  assert.deepEqual(completedControl(true), {
    label: "Show Completed",
    color: "red",
    title: "Completed Items Are Hidden",
  });
  assert.deepEqual(completedControl(false), {
    label: "Hide Completed",
    color: "grey",
    title: "Completed Items Are Visible",
  });
  const toolbar = readFileSync(
    "src/components/romdex/work-toolbar.tsx",
    "utf8",
  );
  assert.match(toolbar, /onClick=\{completed\}/);
  assert.match(toolbar, /aria-pressed=\{data.view.hideCompleted\}/);
  assert.match(toolbar, /aria-hidden="true"/);
  assert.doesNotMatch(toolbar, /<Lamp/);
});
