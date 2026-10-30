import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const source = (name: string) =>
  readFileSync(
    new URL("../../src/components/romdex/" + name, import.meta.url),
    "utf8",
  );
test("workspace recovery and account errors remain wired while tools move out of permanent rows", () => {
  const workspace = source("index.tsx"),
    auth = source("auth-gate.tsx"),
    header = source("workspace-tools.tsx");
  assert.match(workspace, /tools=\{/);
  assert.match(workspace, /<WorkspaceStatus/);
  assert.match(
    workspace,
    /<PwaControls beforeUpdate=\{workspaceStore.prepareUpdate\}/,
  );
  assert.doesNotMatch(workspace, /Web port status and updates/);
  assert.match(
    header,
    /<Dialog title="Workspace tools" close=\{close\} open=\{open\}/,
  );
  assert.match(auth, /!connected \|\| recoveryBlocked/);
  assert.match(auth, /connected && message && !recoveryBlocked/);
});
