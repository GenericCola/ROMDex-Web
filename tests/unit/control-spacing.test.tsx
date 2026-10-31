import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import UpdateCheck from "../../src/components/romdex/update-check";
const root = new URL("../../src/components/romdex/", import.meta.url);
const layoutClasses = new Set([
  "port-actions",
  "dialog-actions",
  "attachment-actions",
  "port-form",
  "row-actions",
  "detail-tabs",
  "tools",
  "suite-popover",
  "port-workspace-status",
  "workspace-tools-panel",
]);
// These are not modal action rows; keep the established desktop interaction layout.
const exceptions: Record<string, string> = {
  "detail-heading.tsx:div":
    "Compact expand/minimize icons in the existing flex detail-top, not dialog actions.",
  "rdx-library.tsx:footer":
    "RDX footer is an explicit shared spaced/wrapping action surface.",
  "selector-branch.tsx:div":
    "Tile controls use the existing selector grid and absolute overlays.",
  "task-summary-children.tsx:div":
    "Mutually exclusive empty-state action versus block child navigation list.",
};
const directButtons = (node: ts.Node): number => {
  if (ts.isJsxElement(node))
    return node.openingElement.tagName.getText() === "button" ? 1 : 0;
  if (ts.isJsxSelfClosingElement(node))
    return node.tagName.getText() === "button" ? 1 : 0;
  let count = 0;
  ts.forEachChild(node, (child) => {
    count += directButtons(child);
  });
  return count;
};
test("every statically rendered multi-button container has an intentional layout; no bare modal sibling actions", () => {
  const found: string[] = [],
    ungrouped: string[] = [];
  for (const file of readdirSync(root).filter((name) =>
    name.endsWith(".tsx"),
  )) {
    const source = ts.createSourceFile(
      file,
      readFileSync(new URL(file, root), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visit = (node: ts.Node) => {
      if (
        ts.isJsxElement(node) &&
        node.children.reduce(
          (count, child) => count + directButtons(child),
          0,
        ) > 1
      ) {
        const tag = node.openingElement.tagName.getText();
        const attribute = node.openingElement.attributes.properties.find(
          (entry) =>
            ts.isJsxAttribute(entry) && entry.name.getText() === "className",
        );
        const value =
          attribute &&
          ts.isJsxAttribute(attribute) &&
          attribute.initializer &&
          ts.isStringLiteral(attribute.initializer)
            ? attribute.initializer.text
            : "";
        const key = `${file}:${tag}`;
        found.push(key);
        if (
          !value.split(/\s+/).some((name) => layoutClasses.has(name)) &&
          !exceptions[key]
        )
          ungrouped.push(key);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.deepEqual(ungrouped, []);
  for (const file of [
    "update-check.tsx",
    "attachment-delete-review.tsx",
    "attachment-cache.tsx",
    "rdx-file-list.tsx",
  ])
    assert.ok(found.includes(file + ":div"), file);
  assert.ok(
    found.length >= 26,
    "the complete known group inventory remains covered",
  );
});
test("shared action CSS uses real two-axis gaps, wrapping and bounded controls without global button margins", () => {
  const css = readFileSync(
    new URL("../../src/styles/romdex-actions.css", import.meta.url),
    "utf8",
  );
  assert.match(css, /--romdex-control-gap:\s*10px/);
  assert.match(css, /flex-wrap:\s*wrap/);
  assert.match(css, /gap:\s*var\(--romdex-control-gap\)/);
  assert.match(css, /max-width:\s*100%/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /:is\(dialog, \.port-form\)/);
  assert.doesNotMatch(
    css,
    /button\s*\+\s*button|\.row-actions|\.detail-tabs|\.selector-main/,
  );
  const globals = readFileSync(
    new URL("../../src/styles/globals.css", import.meta.url),
    "utf8",
  );
  assert.ok(
    globals.indexOf('"./romdex-actions.css"') >
      globals.indexOf('"./romdex-tools.css"'),
  );
});
test("recovery checkbox labels use the shared label gap; native editor footer already has a group", () => {
  for (const file of ["hierarchy-recovery.tsx", "order-recovery.tsx"]) {
    const source = ts.createSourceFile(
      file,
      readFileSync(new URL(file, root), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visit = (node: ts.Node) => {
      if (
        ts.isJsxSelfClosingElement(node) &&
        node.tagName.getText() === "input" &&
        node.attributes.properties.some(
          (entry) => entry.getText() === 'type="checkbox"',
        )
      ) {
        assert.ok(ts.isJsxElement(node.parent));
        assert.match(
          node.parent.openingElement.getText(),
          /className="port-check-line"/,
        );
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.match(
    readFileSync(new URL("item-editor-template.ts", root), "utf8"),
    /class="dialog-actions"/,
  );
});
test("update waiting result renders both existing actions inside one group without invoking either", () => {
  let calls = 0;
  const action = async () => {
    calls++;
  };
  const update = {
    checking: false,
    applying: false,
    message: "Synthetic update ready",
    hasUpdate: true,
    canInstall: false,
    installApp: action,
    checkForUpdates: action,
    reloadToUpdate: action,
  };
  const html = renderToStaticMarkup(
    <UpdateCheck
      update={update}
      close={() => {
        calls++;
      }}
    />,
  );
  assert.match(
    html,
    /<div class="port-actions"><button[^>]*>Apply update<\/button><button[^>]*>Check again<\/button><\/div>/,
  );
  assert.equal(calls, 0);
});

test("sync state labels reserve stable width so mobile header cannot reflow on status changes", () => {
  const css = readFileSync("src/styles/romdex-actions.css", "utf8");
  assert.match(css, /\.auto-sync-toggle \.toggle-value/);
  assert.match(css, /flex: 0 0 6ch/);
});
