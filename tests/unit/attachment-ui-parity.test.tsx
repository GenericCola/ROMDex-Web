import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { knownAttachmentCount } from "../../src/attachments/count";
import TaskAttachmentButton from "../../src/components/romdex/task-attachment-button";
import TaskAttachmentDialog from "../../src/components/romdex/task-attachment-dialog";
import { materialize } from "../../src/domain/accepted/core.mjs";
import { createTask } from "../../src/domain/task-actions";
import { emptyWorkspace } from "../../src/domain/workspace-data";
void test("original attachment entry points count queued files only for the target item", () => {
  const data = emptyWorkspace(),
    id = createTask(data, null, "Fixture");
  const item = materialize(data.remote, data.operations)[0];
  assert.ok(item);
  data.operations.push({
    opId: "upload",
    type: "attachment",
    issueId: id,
    uploadId: "upload",
    file: {
      name: "pixel.png",
      size: 10,
      mimeType: "image/png",
      hash: "a".repeat(64),
    },
  });
  assert.equal(knownAttachmentCount(data, id), 1);
  assert.equal(knownAttachmentCount(data, "other"), 0);
  const html = renderToStaticMarkup(
    <TaskAttachmentButton item={item} count={knownAttachmentCount(data, id)} />,
  );
  assert.match(html, /note-button attachment-button/);
  assert.match(html, /Attachments for Fixture/);
  assert.match(html, /1 Attachment/);
});
void test("attachment modal retains explicit native read, local staging and safe recovery controls", () => {
  const data = emptyWorkspace();
  createTask(data, null, "Fixture");
  const item = materialize(data.remote, data.operations)[0];
  assert.ok(item);
  const html = renderToStaticMarkup(
    <TaskAttachmentDialog
      item={item}
      data={data}
      close={() => {
        return undefined;
      }}
    />,
  );
  assert.match(html, /aria-label="Attachments"/);
  assert.match(html, /attachment-target/);
  assert.match(html, /Fixture · New Item/);
  assert.match(html, /disabled="">Refresh Attachments/);
  assert.match(html, /type="file"/);
  assert.match(html, /Local File Recovery/);
  assert.match(html, /10 MiB/);
});

void test("attachment dialog reads once on open and retains explicit refresh", async () => {
  const { readFile } = await import("node:fs/promises");
  const dialog = await readFile(
    new URL(
      "../../src/components/romdex/task-attachment-dialog.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(dialog, /initialReadRef\.current === item\.id/);
  assert.match(dialog, /if \(!attachmentsReadable\(\)\) return/);
  assert.match(dialog, /initialReadRef\.current = item\.id;\s+read\(\)/);
  const controls = await readFile(
    new URL(
      "../../src/components/romdex/task-attachments.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(controls, /Refresh Attachments/);
  assert.doesNotMatch(controls, />\s*Read Attachments\s*</);
});
