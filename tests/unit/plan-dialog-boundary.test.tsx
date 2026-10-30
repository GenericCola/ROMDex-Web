import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
void test("reused desktop plan dialog stays inside the scoped app and preserves expiry/lifecycle hooks", async () => {
  const view = await readFile(
    new URL("../../src/domain/accepted/plan-import-view.mjs", import.meta.url),
    "utf8",
  );
  const wrapper = await readFile(
    new URL(
      "../../src/components/romdex/plan-import-button.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(view, /button\.closest\("\.romdex-app"\)/);
  assert.match(view, /if\(notice\)dialog.prepend\(notice\)/);
  assert.match(view, /if\(busy\|\|dirty\)/);
  assert.match(wrapper, /createPortal\(<SessionNotice/);
  assert.match(wrapper, /registerDraftEditor/);
  assert.match(wrapper, /trackWorkspaceWork/);
  assert.match(wrapper, /host.cancel\(\)/);
});
