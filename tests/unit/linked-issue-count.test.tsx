import assert from "node:assert/strict";
import test from "node:test";
import { supported } from "../../src/cloud/delivery-helpers";
import { validateTask } from "../../src/domain/validate-task";
import { desktopTask } from "../../src/migration/desktop-task";
import { issueBody } from "../../src/youtrack/issue-body";
import { linkedIssueCount } from "../../src/youtrack/linked-issue-count";
import { nativeIssueFields } from "../../src/youtrack/native-task-fields";
import { normalize, type RawIssue } from "../../src/youtrack/read-tasks";
const raw: RawIssue = {
  id: "1-1",
  idReadable: "PMON-1",
  summary: "Fixture",
  description: "",
  updated: 1,
  project: { shortName: "PMON" },
  customFields: [],
};
const group = (name: string, ids: string[]) => {
  return {
    linkType: { name },
    issues: ids.map((id) => {
      return { id };
    }),
  };
};
void test("original badge count excludes Subtask and counts occurrences across inward/outward groups without deduplication", () => {
  const links = [
    group("Subtask", ["parent", "child"]),
    group("Depends", ["1-2", "1-3"]),
    group("Relates", ["1-2"]),
  ];
  const before = JSON.stringify(links);
  assert.equal(linkedIssueCount(links), 3);
  assert.equal(JSON.stringify(links), before);
  assert.equal(linkedIssueCount([]), 0);
  assert.equal(linkedIssueCount([group("Subtask", ["parent"])]), 0);
  assert.equal(linkedIssueCount(undefined), undefined);
  assert.equal(
    linkedIssueCount([{ linkType: null, issues: [{ id: "1-2" }] }]),
    undefined,
  );
  assert.equal(
    linkedIssueCount([{ issues: [] }, group("Relates", ["1-2"])]),
    undefined,
  );
});
void test("malformed native links cannot turn into a verified zero", () => {
  for (const links of [
    null,
    {},
    [null],
    [{ linkType: "x", issues: [] }],
    [{ linkType: { name: 42 }, issues: [] }],
    [{ linkType: { name: "Relates" } }],
    [{ linkType: { name: "Relates" }, issues: [{}] }],
    [{ linkType: { name: "Subtask" }, issues: "bad" }],
  ])
    assert.throws(() => {
      return linkedIssueCount(links);
    });
});
void test("native common projection uses untrimmed links and many-link normalization retains original counts", () => {
  assert.match(nativeIssueFields, /links\(linkType\(name\),issues\(id\)\)/);
  assert.doesNotMatch(nativeIssueFields, /trimmedIssues/);
  const links = [
    group(
      "Relates",
      Array.from({ length: 150 }, (_, i) => {
        return "1-" + i;
      }),
    ),
  ];
  const item = normalize({ ...raw, links });
  assert.equal(item.dependencies, 150);
  validateTask(item);
  assert.equal(normalize(raw).dependencies, undefined);
  assert.equal(normalize({ ...raw, links: [] }).dependencies, 0);
});
void test("desktop projection and recovery validation preserve optional count and reject invalid counts", () => {
  const base = { id: "PMON-1", summary: "Fixture", parentId: null, updated: 1 };
  for (const count of [0, 7, Number.MAX_SAFE_INTEGER]) {
    const item = desktopTask({ ...base, dependencies: count });
    assert.equal(item.dependencies, count);
    validateTask(JSON.parse(JSON.stringify(item)));
  }
  assert.equal(desktopTask(base).dependencies, undefined);
  for (const count of [
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    NaN,
    Infinity,
    "3",
    null,
    true,
  ]) {
    assert.throws(() => {
      return validateTask({ ...normalize(raw), dependencies: count });
    });
    assert.throws(() => {
      return desktopTask({ ...base, dependencies: count });
    });
  }
});
void test("read-only count never becomes a supported outgoing task field", () => {
  assert.equal(supported({ dependencies: 3 } as never), false);
  assert.throws(() => {
    return issueBody({ summary: "safe", dependencies: 3 } as never, []);
  }, /cannot be safely delivered/);
});
