import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import Details from "../../src/components/romdex/details";
import DeviceBody from "../../src/components/romdex/device-body";
import { WorkSelectionProvider } from "../../src/components/romdex/work-selection-provider";
import { materialize } from "../../src/domain/accepted/core.mjs";
import { createTask } from "../../src/domain/task-actions";
import { emptyWorkspace } from "../../src/domain/workspace-data";
void test("Details restores original summary and writing columns without invented parent controls or image panel", () => {
  const data = emptyWorkspace();
  const parent = createTask(data, null, "Parent");
  createTask(data, parent, "Child");
  data.view.selected = parent;
  const html = renderToStaticMarkup(
    <WorkSelectionProvider>
      <DeviceBody inert={false} enabled>
        <Details
          data={data}
          items={materialize(data.remote, data.operations)}
        />
      </DeviceBody>
    </WorkSelectionProvider>,
  );
  assert.match(html, /class="detail-scroll"/);
  assert.match(html, /id="detail-parent"/);
  assert.match(html, /Top-Level Epic/);
  assert.match(html, /id="detail-title" class="detail-title"/);
  assert.match(html, /Children · 1/);
  assert.match(html, /class="detail-child"/);
  assert.match(html, /id="notes-panel"/);
  assert.doesNotMatch(
    html,
    /port-detail-content|Task image|aria-label="Parent"/,
  );
  assert.match(html, /<span class="">Untouched<\/span>/);
});
