import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RdxFileList from "../../src/components/romdex/rdx-file-list";
import RdxLibrary from "../../src/components/romdex/rdx-library";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import type { RdxFile } from "../../src/rdx/types";
const file: RdxFile = {
  name: "retained-plan.rdx",
  sha256: "synthetic-checksum",
  bytes: 1,
  data: "AA==",
  documentId: "plan-one",
  datasetId: "PMON",
  revision: "revision-one",
  kind: "plan",
};
const data = () => {
  return { ...emptyWorkspace(), rdxFiles: [file] };
};
const close = () => {
  return undefined;
};
void test("export dialog is document-only with no import, inspect or save controls", () => {
  const before = data();
  const markup = renderToStaticMarkup(
    <RdxLibrary data={before} close={close} mode="export" />,
  );
  assert.match(markup, /EXPORT RDX/);
  assert.match(markup, /Export retained-plan.rdx/);
  assert.match(markup, /not your entire PMON workspace/);
  assert.doesNotMatch(
    markup,
    /type="file"|Inspect |Review retained|Save RDX|Open Map|Desktop RDX files/,
  );
  assert.deepEqual(before, data());
});
void test("export empty state makes absence of retained documents explicit", () => {
  const markup = renderToStaticMarkup(
    <RdxLibrary data={emptyWorkspace()} close={close} mode="export" />,
  );
  assert.match(markup, /No retained RDX documents are available to export/);
  assert.doesNotMatch(markup, /type="file"/);
});
void test("import mode keeps file validation entry and inspect but hides export; default retains both", () => {
  const imported = renderToStaticMarkup(
    <RdxLibrary data={data()} close={close} mode="import" />,
  );
  assert.match(imported, /IMPORT RDX/);
  assert.match(imported, /type="file"/);
  assert.match(imported, /accept=".rdx"/);
  assert.match(imported, /Inspect retained-plan.rdx/);
  assert.doesNotMatch(imported, /Export retained-plan.rdx/);
  const combined = renderToStaticMarkup(
    <RdxLibrary data={data()} close={close} />,
  );
  assert.match(combined, /RDX Files/);
  assert.match(combined, /Inspect retained-plan.rdx/);
  assert.match(combined, /Export retained-plan.rdx/);
});
void test("export action delegates exact retained document to existing checksum-validated download only", () => {
  const calls: RdxFile[] = [];
  const model = {
    busy: false,
    select: () => {
      return Promise.reject(Error("Import must not run"));
    },
    openFile: () => {
      throw Error("Inspect must not run");
    },
    download: (selected: RdxFile) => {
      calls.push(selected);
      return Promise.resolve();
    },
  };
  const tree = RdxFileList({ data: data(), model, mode: "export" });
  const visit = (node: ReactNode) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const child = node;
    if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(child))
      return;
    if (child.type === "button") child.props.onClick?.();
    else visit(child.props.children);
  };
  visit(tree);
  assert.deepEqual(calls, [file]);
  assert.equal(calls[0], file);
});
