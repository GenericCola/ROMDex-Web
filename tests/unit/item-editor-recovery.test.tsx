import assert from "node:assert/strict";
import test from "node:test";
import { captureItemControls } from "../../src/components/romdex/item-editor-recovery";
type Control = Parameters<typeof captureItemControls>[0][number];
const control = (patch: Record<string, unknown>) => {
  const attributes = (patch.attributes ?? {}) as Record<string, string>;
  return {
    id: "",
    value: "",
    tagName: "INPUT",
    type: "text",
    disabled: false,
    readOnly: false,
    getAttribute: (key: string) => {
      return attributes[key] ?? null;
    },
    ...patch,
  } as unknown as Control;
};
const controls = () => {
  return [
    control({ id: "edit-name", value: "Uncommitted title" }),
    control({ id: "edit-due-date", type: "date", value: "" }),
    control({ attributes: { "data-custom-key": "custom:a" }, value: "2h 30m" }),
    control({
      attributes: { "data-custom-key": "custom:b" },
      value: "",
      disabled: true,
    }),
    control({
      tagName: "SELECT",
      type: "select-multiple",
      multiple: true,
      attributes: { "data-custom-key": "custom:c" },
      value: "unknown",
      selectedOptions: [
        { value: "unknown", label: "Same label" },
        { value: "known", label: "Same label" },
      ],
    }),
    control({
      tagName: "SELECT",
      type: "select-multiple",
      multiple: true,
      attributes: { "data-custom-key": "custom:empty" },
      value: "",
      selectedOptions: [],
    }),
    control({
      type: "checkbox",
      value: "on",
      checked: true,
      attributes: { "data-edit-tag": "tag-a" },
    }),
    control({
      type: "checkbox",
      value: "on",
      checked: false,
      attributes: { "data-edit-tag": "tag-b" },
    }),
  ];
};
void test("captures stable native/custom/tag identities and exact choices without mutating controls", () => {
  const source = controls();
  const before = JSON.stringify(source);
  const captured = captureItemControls(source);
  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(captured[0], {
    id: "edit-name",
    value: "Uncommitted title",
    element: "input",
    type: "text",
    disabled: false,
    readOnly: false,
  });
  assert.equal(captured[1]!.value, "");
  assert.equal(captured[2]!.customKey, "custom:a");
  assert.equal(captured[2]!.value, "2h 30m");
  assert.equal(captured[3]!.disabled, true);
  assert.deepEqual(captured[4]!.selectedValues, ["unknown", "known"]);
  assert.equal(captured[4]!.value, "unknown");
  assert.deepEqual(captured[5]!.selectedValues, []);
  assert.deepEqual(
    captured.slice(6).map((entry) => {
      return [entry.tagId, entry.checked];
    }),
    [
      ["tag-a", true],
      ["tag-b", false],
    ],
  );
});
void test("does not capture file inputs or password contents", () => {
  assert.deepEqual(
    captureItemControls([
      control({ type: "file", value: "C:\\fakepath\\private.txt" }),
      control({ type: "password", value: "not-for-recovery" }),
    ]),
    [],
  );
});
