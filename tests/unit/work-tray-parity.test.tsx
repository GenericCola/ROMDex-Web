import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import DeviceBody from "../../src/components/romdex/device-body";
import TaskField from "../../src/components/romdex/task-field";
import { WorkSelectionProvider } from "../../src/components/romdex/work-selection-provider";
import WorkTable from "../../src/components/romdex/work-table";
import { materialize } from "../../src/domain/accepted/core.mjs";
import { fieldPresentation } from "../../src/domain/field-presentation";
import { createTask, editTask } from "../../src/domain/task-actions";
import { emptyWorkspace } from "../../src/domain/workspace-data";

void test("desktop field badges preserve native values and disclose unknown values", () => {
  assert.deepEqual(fieldPresentation("priority", "Major"), {
    value: "Major",
    label: "HIGH",
    color: "yellow",
  });
  assert.equal(fieldPresentation("priority", "Critical").label, "URGENT");
  assert.equal(fieldPresentation("priority", "Show-stopper").color, "red");
  assert.equal(fieldPresentation("complexity", null).label, "—");
  assert.equal(fieldPresentation("complexity", "future").label, "FUTURE ⚠");
});

void test("work tray restores desktop headings, summaries, badges and compact row structure", () => {
  const data = emptyWorkspace();
  const parent = createTask(data, null, "[Epic] Fixture");
  const child = createTask(data, parent, "Child");
  editTask(data, child, {
    priority: "Major",
    complexity: "MID",
    assignedState: "Done",
  });
  data.view.expanded = [parent];
  const items = materialize(data.remote, data.operations);
  const before = JSON.stringify(data);
  const html = renderToStaticMarkup(
    <WorkSelectionProvider>
      <DeviceBody enabled inert={false}>
        <WorkTable
          data={data}
          items={items}
          add={() => {
            return undefined;
          }}
        />
      </DeviceBody>
    </WorkSelectionProvider>,
  );
  assert.match(html, /<h2>All Tasks<\/h2>/);
  assert.match(html, /2 Items/);
  assert.match(html, /class="breadcrumbs"/);
  assert.match(html, /class="task-cell"/);
  assert.match(html, /class="row-hierarchy"/);
  assert.match(html, /class="field-tag yellow"/);
  assert.match(html, /class="row-actions"/);
  assert.match(html, /class="trash-icon"/);
  assert.match(html, /aria-keyshortcuts="Alt\+ArrowUp Alt\+ArrowDown"/);
  assert.doesNotMatch(html, /aria-label="Move .* (up|down)"/);
  assert.match(html, /class="sr-only">Actions/);
  assert.doesNotMatch(
    html,
    /Your Project|Changes stay in this browser|draggable="true"/,
  );
  assert.equal(JSON.stringify(data), before);
  data.view.scope = parent;
  const scoped = renderToStaticMarkup(
    <WorkSelectionProvider>
      <DeviceBody enabled inert={false}>
        <WorkTable
          data={data}
          items={items}
          add={() => {
            return undefined;
          }}
        />
      </DeviceBody>
    </WorkSelectionProvider>,
  );
  assert.match(scoped, /<h2>Fixture<\/h2>/);
  assert.match(scoped, /1 Item/);
});

void test("native Show-stopper remains distinct from Critical in field options", () => {
  const data = emptyWorkspace(),
    id = createTask(data, null, "Native");
  editTask(data, id, { priority: "Show-stopper" });
  const item = materialize(data.remote, data.operations)[0];
  assert.ok(item);
  const html = renderToStaticMarkup(<TaskField item={item} field="priority" />);
  assert.match(html, /Show-stopper \(Current\)/);
  assert.match(html, /value="Critical"/);
  assert.match(html, /value="Show-stopper" selected=""/);
});
