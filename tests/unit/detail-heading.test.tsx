import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import DetailHeading from "../../src/components/romdex/detail-heading";
void test("Details restores original left Back/location group and rotating expansion icon", () => {
  const noop = () => {
    return undefined;
  };
  const html = renderToStaticMarkup(
    <DetailHeading
      item={undefined}
      previous={undefined}
      multiple={false}
      expanded={true}
      back={noop}
      resize={noop}
      minimize={noop}
    />,
  );
  assert.match(html, /class="detail-location"><button id="detail-back"/);
  assert.match(html, /id="detail-back"[^>]*disabled=""/);
  assert.match(html, /<svg viewBox="0 0 16 16"/);
  assert.match(html, /id="detail-id">Task Details/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /class="detail-expand-arrow"/);
});

void test("file-drop mounting anchor cannot introduce an implicit device-body grid row", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../../src/components/romdex/task-file-drop.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /<span ref=\{anchorRef\} hidden aria-hidden="true"/);
});

void test("work row restores pending marker and paper SVG without invented task thumbnails", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../../src/components/romdex/work-row.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /className="pending-dot" title="Pending Changes"/);
  assert.match(source, /<NotesIcon/);
  assert.doesNotMatch(source, /port-task-thumbnail|data\.images/);
});

void test("desktop status dialog uses original dimensions rather than recovery-panel overrides", async () => {
  const { default: Dialog } =
    await import("../../src/components/romdex/dialog");
  const html = renderToStaticMarkup(
    <Dialog
      title="Set Status"
      desktop
      close={() => {
        return undefined;
      }}
    >
      Fixture
    </Dialog>,
  );
  assert.match(html, /class="desktop-dialog"/);
  assert.doesNotMatch(html, /class="port-dialog/);
});

void test("Tile Settings restores original dialog identity and form spacing without recovery grid", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../../src/components/romdex/tile-settings.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /id="image-dialog"/);
  assert.match(source, /canClose=\{!busy\}\s+desktop/);
  assert.match(source, /<form id="tile-settings-form" onSubmit=\{submit\}>/);
  assert.doesNotMatch(source, /className="port-form"/);
});

void test("existing desktop filters and deletion retain desktop frames without dropping safety review", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = (name: string) => {
    return readFile(
      new URL("../../src/components/romdex/" + name, import.meta.url),
      "utf8",
    );
  };
  assert.match(
    await source("task-filters.tsx"),
    /<Dialog id="task-filter-dialog" title="Filters" close=\{close\} desktop>/,
  );
  const deletion = await source("delete-review.tsx");
  assert.match(deletion, /id="delete-dialog"\s+desktop/);
  assert.match(deletion, /queueReviewedDeletion/);
  assert.match(deletion, /cannot restore/);
});

void test("launcher styles cannot leak into nested desktop dialog controls", async () => {
  const { readFile } = await import("node:fs/promises");
  const css = await readFile(
    new URL("../../src/styles/romdex-desktop.css", import.meta.url),
    "utf8",
  );
  assert.match(css, /\.tools > button\{/);
  assert.match(css, /\.row-actions > button\{/);
  assert.match(css, /\.header-actions button:not\(dialog \*\)\{/);
  assert.doesNotMatch(css, /\.tools button\{|\.row-actions button\{/);
  assert.match(css, /dialog\{font:13px\/1\.5 system-ui/);
});

void test("attachments restore original file control and checkerboard preview without removing recovery", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = (name: string) => {
    return readFile(
      new URL("../../src/components/romdex/" + name, import.meta.url),
      "utf8",
    );
  };
  assert.match(
    await source("task-attachment-dialog.tsx"),
    /id="attachments-dialog"\s+desktop/,
  );
  const controls = await source("task-attachments.tsx");
  assert.match(controls, /className="attach-file-control"/);
  assert.match(controls, /className="sr-only"\s+aria-label="Attach Files"/);
  assert.match(controls, /Local File Recovery/);
  const preview = await source("attachment-preview.tsx");
  assert.match(preview, /title="File Preview"/);
  assert.match(preview, /className="file-preview-stage"/);
  assert.match(preview, /id="file-preview-image"/);
  assert.match(preview, /Download Original/);
});

void test("Details keeps desktop pending-item and expanded-tray labels", async () => {
  const { emptyWorkspace } = await import("../../src/domain/workspace-data");
  const { createTask } = await import("../../src/domain/task-actions");
  const { materialize } = await import("../../src/domain/accepted/core.mjs");
  const data = emptyWorkspace();
  createTask(data, null, "Fixture");
  const item = materialize(data.remote, data.operations)[0];
  const noop = () => {
    return undefined;
  };
  const html = renderToStaticMarkup(
    <DetailHeading
      item={item}
      previous={undefined}
      multiple={false}
      expanded={true}
      back={noop}
      resize={noop}
      minimize={noop}
    />,
  );
  assert.match(html, /New Item · Pending/);
  assert.match(html, /aria-label="Restore Default Tray Split"/);
});

void test("leaving expanded Details restores original automatic sizing instead of a stale resized ratio", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../../src/components/romdex/details.tsx", import.meta.url),
    "utf8",
  );
  assert.equal(
    source.match(
      /if \(next.view.detailsMode === "expanded"\)\s+next.view.automaticTrayHeight = true/g,
    )?.length,
    2,
  );
});
