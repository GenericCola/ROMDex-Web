import {
  authIdentity,
  authRequestGuard,
  authToken,
  hasAuthSession,
} from "@/auth/session";
import { materialize } from "@/domain/accepted/core.mjs";
import type { ItemEditorHost } from "@/domain/accepted/item-editor-view.mjs";
import type { JsonObject } from "@/domain/json";
import { reviewedItemEdit } from "@/domain/reviewed-item-edit";
import type { TaskItem } from "@/domain/types";
import { findWorkspaceItem } from "@/domain/workspace-item";
import { workspaceStore } from "@/domain/workspace-store";
import { trackWorkspaceWork } from "@/domain/workspace-work";
import { readEditOptions } from "@/youtrack/edit-options";
import { sessionRequest } from "@/youtrack/request";
import { configuration } from "./item-editor-support";
import { readItemTagBaseline } from "./item-tag-baseline";
export const itemEditorHost = (item: TaskItem): ItemEditorHost => {
  let options: JsonObject = {
    ...configuration,
    assignee: {
      ...configuration.assignee,
      options: (item.assignees ?? []).map((person) => {
        return {
          id: person.id,
          login: person.id,
          name: person.name,
        };
      }),
    },
    tags: { ...configuration.tags, options: item.tagNames ?? [] },
  };
  return {
    get state() {
      return {
        editOptions: options,
        operations: workspaceStore.getSnapshot().data.operations,
      };
    },
    get items() {
      const { data } = workspaceStore.getSnapshot();
      return materialize(data.remote, data.operations);
    },
    get connected() {
      return hasAuthSession();
    },
    loadEditOptions: async (id) => {
      const token = authToken(),
        guard = authRequestGuard(token),
        identity = authIdentity();
      const result = await readEditOptions(
        sessionRequest(token),
        identity.projectId,
      );
      guard();
      await readItemTagBaseline(id, token, result.options);
      guard();
      ({ options } = result);
      const { data } = workspaceStore.getSnapshot();
      const current = findWorkspaceItem(data, id) ?? null;
      return { options, item: current };
    },
    edit: (id, patch, base) => {
      return trackWorkspaceWork(async () => {
        await workspaceStore.change((data) => {
          reviewedItemEdit(data, id, patch, base, options);
        });
        await workspaceStore.flush();
      });
    },
  };
};
