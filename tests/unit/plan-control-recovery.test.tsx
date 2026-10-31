import assert from "node:assert/strict";
import test from "node:test";
import { captureItemControls } from "../../src/components/romdex/item-editor-recovery";
type Control = Parameters<typeof captureItemControls>[0][number];
const field = (
  attributes: Record<string, string>,
  extra: Record<string, unknown> = {},
) => {
  return {
    id: "",
    value: "",
    type: "select-one",
    tagName: "SELECT",
    disabled: false,
    multiple: false,
    selectedOptions: [],
    getAttribute: (key: string) => {
      return attributes[key] ?? null;
    },
    closest: () => {
      return { textContent: "Keep Which Version?" };
    },
    ...extra,
  } as unknown as Control;
};
void test("RDX manual recovery keeps duplicate labels distinct by keys and position without losing checkbox or select choices", () => {
  const fields = [
    field(
      {
        "aria-label": "Keep Which Version?",
        "data-recovery-key": "import:a",
        name: "decision-a",
      },
      { value: "local", selectedOptions: [{ value: "local" }] },
    ),
    field(
      { "aria-label": "Keep Which Version?", "data-recovery-key": "import:b" },
      { value: "", selectedOptions: [{ value: "" }] },
    ),
    field(
      { "data-recovery-key": "delete:task-a" },
      { tagName: "INPUT", type: "checkbox", value: "on", checked: true },
    ),
    field(
      { "data-recovery-key": "delete:task-b" },
      { tagName: "INPUT", type: "checkbox", value: "on", checked: false },
    ),
    field(
      { "aria-label": "Multiple", "data-recovery-key": "mapping:a" },
      {
        type: "select-multiple",
        multiple: true,
        value: "unknown",
        selectedOptions: [{ value: "unknown" }, { value: "second" }],
      },
    ),
  ];
  const before = JSON.stringify(fields);
  const result = captureItemControls(fields, true);
  assert.equal(JSON.stringify(fields), before);
  assert.deepEqual(
    result.slice(0, 2).map((value) => {
      return [value.label, value.position, value.recoveryKey, value.value];
    }),
    [
      ["Keep Which Version?", 0, "import:a", "local"],
      ["Keep Which Version?", 1, "import:b", ""],
    ],
  );
  assert.equal(result[0]!.name, "decision-a");
  assert.deepEqual(
    result.slice(2, 4).map((value) => {
      return [value.recoveryKey, value.checked];
    }),
    [
      ["delete:task-a", true],
      ["delete:task-b", false],
    ],
  );
  assert.deepEqual(result[4]!.selectedValues, ["unknown", "second"]);
});
void test("RDX capture excludes file/password inputs before inspecting their labels", () => {
  const unsafe = (type: string) => {
    return field(
      {},
      {
        tagName: "INPUT",
        type,
        closest: () => {
          throw Error("must not inspect");
        },
      },
    );
  };
  assert.deepEqual(
    captureItemControls([unsafe("file"), unsafe("password")], true),
    [],
  );
});
