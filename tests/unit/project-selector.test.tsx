import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { prepareProject } from "../../src/auth/open-workspace";
import { ProjectSelectionContext } from "../../src/components/romdex/project-selection-context";
import ProjectSelector from "../../src/components/romdex/project-selector";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { WorkspaceStore } from "../../src/domain/workspace-store";
const selected = { id: "0-1", name: "Pokémon", shortName: "PMON" };
test("project heading is a keyboard button; rendering never switches or reveals chooser", () => {
  let choices = 0;
  const choose = async () => {
    choices++;
  };
  const html = renderToStaticMarkup(
    <ProjectSelectionContext
      value={{ selected, projects: [selected], disabled: false, choose }}
    >
      <ProjectSelector />
    </ProjectSelectionContext>,
  );
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /Change project: Pokémon \(PMON\)/);
  assert.doesNotMatch(html, /<dialog/);
  assert.equal(choices, 0);
});
test("switching away and back retains conflict evidence, queue, and draft per workspace", async () => {
  const original = emptyWorkspace();
  original.commentDrafts["PMON-1"] = "Unsent draft";
  original.operations.push({
    type: "comment",
    opId: "held",
    issueId: "PMON-1",
    text: "Queued",
    created: 1,
  });
  original.cloud = {
    accountId: "fixture",
    autoSync: false,
    records: { held: { status: "conflict", message: "Review" } },
  };
  const persistence = (initial: typeof original) => {
    let saved = structuredClone(initial),
      revision = 0;
    return {
      load: async () => ({ revision, data: structuredClone(saved) }),
      save: async (data: typeof original, expected: number) => {
        assert.equal(expected, revision);
        saved = structuredClone(data);
        return ++revision;
      },
    };
  };
  const first = persistence(original),
    second = persistence(emptyWorkspace());
  const store = new WorkspaceStore(first);
  await store.start();
  await store.change((data) => {
    data.commentDrafts["PMON-2"] = "Persisted before project switch";
  });
  await store.flush();
  original.commentDrafts["PMON-2"] = "Persisted before project switch";
  await store.switchPersistence(second);
  assert.equal(store.getSnapshot().data.operations.length, 0);
  await store.switchPersistence(first);
  assert.deepEqual(store.getSnapshot().data, original);
});
test("project choice rechecks permission and rejects revoked project before reading its tasks", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(options?.method, "GET");
    calls.push(String(url));
    return Response.json(
      String(url).includes("users/me")
        ? { id: "user", login: "fixture", fullName: "Fixture" }
        : [],
    );
  };
  try {
    await assert.rejects(
      prepareProject("synthetic", "user", selected, () => true),
      /no longer available/,
    );
    assert.equal(
      calls.some((url) => url.includes("/issues")),
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
