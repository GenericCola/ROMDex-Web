import { authRequestGuard } from "@/auth/session";
import type { JsonObject } from "@/domain/json";
import { applyTaskTagBaseline } from "@/domain/task-tag-baseline";
import { workspaceStore } from "@/domain/workspace-store";
import { sessionRequest } from "@/youtrack/request";
import { TagClient } from "@/youtrack/tags";
export const readItemTagBaseline = async (
  id: string,
  token: string,
  options: JsonObject,
) => {
  if (!/^PMON-\d+$/.test(id)) return;
  const guard = authRequestGuard(token);
  const tags = await new TagClient(sessionRequest(token)).list(id);
  guard();
  const config = options.tags as JsonObject | undefined;
  const entries = Array.isArray(config?.options) ? config.options : [];
  const choices = entries.flatMap((entry) => {
    return entry &&
      typeof entry === "object" &&
      !Array.isArray(entry) &&
      typeof entry.id === "string" &&
      typeof entry.name === "string"
      ? [{ id: entry.id, name: entry.name }]
      : [];
  });
  await workspaceStore.change((data) => {
    guard();
    applyTaskTagBaseline(data, id, tags, choices);
  });
  await workspaceStore.flush();
};
