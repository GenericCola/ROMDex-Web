import type { JsonObject } from "@/domain/json";
type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
// Evidence for manual recovery, never a command to replay edits or upload files.
export const captureItemControls = (
  controls: readonly Control[],
  labels = false,
): JsonObject[] => {
  return controls.flatMap((control, position) => {
    if (
      control.tagName === "INPUT" &&
      ["file", "password"].includes(control.type)
    )
      return [];
    const entry: JsonObject = {
      id: control.id,
      value: control.value,
      element: control.tagName.toLowerCase(),
      type: control.type,
      disabled: control.disabled,
    };
    const customKey = control.getAttribute("data-custom-key"),
      tagId = control.getAttribute("data-edit-tag");
    const name = control.getAttribute("name"),
      recoveryKey = control.getAttribute("data-recovery-key");
    if (name !== null) entry.name = name;
    if (recoveryKey !== null) entry.recoveryKey = recoveryKey;
    if (labels) {
      entry.position = position;
      entry.label =
        control.getAttribute("aria-label") ??
        control.closest("label")?.textContent ??
        "Plan field";
    }
    if (customKey !== null) entry.customKey = customKey;
    if (tagId !== null) entry.tagId = tagId;
    if ("readOnly" in control) entry.readOnly = control.readOnly;
    if (
      control.tagName === "INPUT" &&
      ["checkbox", "radio"].includes(control.type)
    )
      entry.checked = (control as HTMLInputElement).checked;
    if (control.tagName === "SELECT") {
      const select = control as HTMLSelectElement;
      entry.multiple = select.multiple;
      entry.selectedValues = [...select.selectedOptions].map((option) => {
        return option.value;
      });
    }
    return [entry];
  });
};
