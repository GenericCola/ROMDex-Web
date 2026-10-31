import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
const source = (name: string) =>
  readFileSync(
    new URL("../../src/components/romdex/" + name, import.meta.url),
    "utf8",
  );
test("TOOLS replaces header gear beside completed filter with exactly three actions", () => {
  const tools = source("workspace-tools.tsx"),
    toolbar = source("work-toolbar.tsx"),
    header = source("header.tsx");
  assert.doesNotMatch(
    header,
    /WorkspaceTools|suite-settings-slot|standard-settings-icon/,
  );
  assert.match(toolbar, /id="toggle-completed"[\s\S]*<WorkspaceTools/);
  for (const label of ["EXPORT RDX", "IMPORT RDX", "CHECK FOR UPDATES"])
    assert.equal(tools.split(label).length - 1, 1);
  assert.equal((tools.match(/<button/g) ?? []).length, 4);
  assert.doesNotMatch(tools, /Recovery|Migration|Install ROMDex|Sign out/);
});
test("account, project, recovery and update safety remain accessible outside normal TOOLS menu", () => {
  const workspace = source("index.tsx"),
    auth = source("auth-gate.tsx");
  assert.match(workspace, /usePwa\(workspaceStore.prepareUpdate\)/);
  assert.match(workspace, /recoveryMode\(\) &&[\s\S]*<WorkspaceStatus/);
  assert.match(
    workspace,
    /<Connection close=\{closeConnection\} account=\{account\}/,
  );
  assert.match(source("selectors.tsx"), /<ProjectSelector/);
  assert.match(auth, /!connected \|\| recoveryBlocked/);
  assert.match(auth, /connected && message && !recoveryBlocked/);
});
test("exact GenDex spinner is visible only during real checking and offers separate safe apply", () => {
  const asset = readFileSync("public/romdex/update-pokeball.svg");
  assert.equal(
    createHash("sha256").update(asset).digest("hex"),
    "8103c2ea8be0117dad79117f35e2645ad5c7eb4677cb9e521fdd60262d48082c",
  );
  const dialog = source("update-check.tsx");
  assert.match(dialog, /update.checking &&[\s\S]*romdex-update-spinner/);
  assert.match(dialog, /update.hasUpdate &&[\s\S]*Apply update/);
  assert.match(dialog, /disabled=\{update.checking \|\| update.applying\}/);
  assert.match(dialog, /role="status"/);
  const css = readFileSync("src/styles/romdex-tools.css", "utf8");
  assert.match(css, /3s linear infinite/);
  assert.match(css, /prefers-reduced-motion[\s\S]*8s/);
});
