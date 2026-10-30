import { validateAttachmentOperation } from "@/attachments/validate";
import { nativeEditKey, nativePatchValue } from "@/domain/native-edit-fields";
import type { TaskOperation } from "@/domain/types";
import { validateTask } from "@/domain/validate-task";
import {
  invalidQueue as invalid,
  queueObject as object,
  queueText as text,
} from "./queue-shape";
import { tagIds } from "./tag-types";
export const validateOperation = (operation: TaskOperation) => {
  switch (operation.type) {
    case "attachment":
    case "attachment-delete":
      validateAttachmentOperation(operation);
      break;
    case "edit":
      if (
        !object(operation.base) ||
        operation.base.id !== operation.issueId ||
        !object(operation.patch)
      )
        invalid();
      validateTask(operation.base);
      for (const [key, value] of Object.entries(operation.patch)) {
        if (key === "tags") {
          tagIds(value);
          tagIds(operation.base.tags);
          continue;
        }
        if (nativeEditKey(key)) {
          if (!nativePatchValue(key, value)) invalid();
          continue;
        }
        if (
          ![
            "summary",
            "description",
            "parentId",
            "state",
            "assignedState",
            "priority",
            "complexity",
          ].includes(key) ||
          !(
            typeof value === "string" ||
            (value === null && ["parentId", "complexity"].includes(key))
          ) ||
          (key === "summary" && !String(value).trim())
        )
          invalid();
      }
      break;
    case "comment":
      if (!text(operation.text) || !operation.text.trim()) invalid();
      break;
    case "create":
      if (!object(operation.item) || operation.item.id !== operation.issueId)
        invalid();
      validateTask(operation.item);
      break;
    case "delete":
      if (
        !Array.isArray(operation.ids) ||
        !operation.ids.length ||
        new Set(operation.ids).size !== operation.ids.length ||
        !operation.ids.includes(operation.issueId) ||
        !operation.ids.every((id) => {
          return (
            typeof id === "string" &&
            (/^PMON-\d+$/.test(id) || id.startsWith("local-"))
          );
        })
      )
        invalid();
      for (const [id, base] of Object.entries(operation.bases ?? {})) {
        validateTask(base);
        if (base.id !== id || !operation.ids.includes(id)) invalid();
      }
      break;
    default:
      invalid();
  }
};
