import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { rowRange, rowSegments } from "../../src/components/romdex/row-window";
import {
  publishRowOrder,
  rowOrder,
} from "../../src/components/romdex/task-row-order";
import TaskRows from "../../src/components/romdex/task-rows";
import { materialize } from "../../src/domain/accepted/core.mjs";
import { createTask } from "../../src/domain/task-actions";
import { emptyWorkspace } from "../../src/domain/workspace-data";

void test("row range covers every entry overlapping the measured window", () => {
  const sizes = [40, 40, 80, 40, 40];
  assert.deepEqual(rowRange(sizes, 0, 40), { first: 0, last: 0 });
  assert.deepEqual(rowRange(sizes, 39, 81), { first: 0, last: 2 });
  assert.deepEqual(rowRange(sizes, 100, 161), { first: 2, last: 3 });
  assert.deepEqual(rowRange(sizes, -600, 0), { first: 5, last: -1 });
  assert.deepEqual(rowRange(sizes, 500, 900), { first: 5, last: -1 });
});

void test("segments keep pinned rows in place and spacers sum the skipped heights", () => {
  const sizes = [10, 20, 30, 40, 50, 60, 70];
  const segments = rowSegments(sizes, { first: 3, last: 4 }, [0, 6, -1, 9]);
  assert.deepEqual(segments, [
    { kind: "row", index: 0 },
    { kind: "gap", from: 1, height: 50 },
    { kind: "row", index: 3 },
    { kind: "row", index: 4 },
    { kind: "gap", from: 5, height: 60 },
    { kind: "row", index: 6 },
  ]);
  assert.deepEqual(rowSegments([5, 5], { first: 2, last: -1 }, []), [
    { kind: "gap", from: 0, height: 10 },
  ]);
});

void test("drop targets read the published visible order before the DOM", () => {
  const root = {
    querySelectorAll: () => {
      return [{ dataset: { row: "PMON-1" } }];
    },
  } as unknown as ParentNode;
  assert.deepEqual(rowOrder(root), ["PMON-1"]);
  const unpublish = publishRowOrder(["PMON-1", "PMON-2", "PMON-3"]);
  assert.deepEqual(rowOrder(root), ["PMON-1", "PMON-2", "PMON-3"]);
  unpublish();
  assert.deepEqual(rowOrder(root), ["PMON-1"]);
});

void test("a long table renders its first screen, a spacer and the off-screen draft", () => {
  const data = emptyWorkspace();
  const ids: string[] = [];
  for (let index = 0; index < 200; index++)
    ids.push(createTask(data, null, "Row " + index));
  const items = materialize(data.remote, data.operations);
  data.newTask = { afterId: ids[150] ?? null, parentId: null, title: "" };
  const html = renderToStaticMarkup(
    <table>
      <TaskRows
        rows={items}
        data={data}
        items={items}
        render={(item, rowIndex) => {
          return (
            <tr key={item.id} data-row={item.id} aria-rowindex={rowIndex}>
              <td>{item.summary}</td>
            </tr>
          );
        }}
        group={null}
        closeGroup={() => {
          return undefined;
        }}
      />
    </table>,
  );
  const rendered = [...html.matchAll(/data-row="([^"]+)"/g)].map((match) => {
    return match[1];
  });
  assert.ok(rendered.length > 10 && rendered.length < 60, "first screen only");
  assert.deepEqual(rendered, ids.slice(0, rendered.length));
  assert.match(html, /aria-rowindex="2"/);
  assert.match(html, new RegExp(`aria-rowindex="${rendered.length + 1}"`));
  assert.match(html, /aria-label="New Epic Title"|class="draft-row"/);
  assert.match(html, /class="draft-row"[^>]*aria-rowindex="153"/);
  // Unmeasured rows use the 37px estimate: rows before the draft, then the rows after it.
  const gaps = [
    ...html.matchAll(
      /class="row-gap"[^>]*><td colSpan="4" style="height:(\d+)px"/g,
    ),
  ].map((match) => {
    return Number(match[1]);
  });
  assert.deepEqual(gaps, [(151 - rendered.length) * 37, 49 * 37]);
});
