import { cloudData } from "@/cloud/types";
import { jsonObject, parseJson } from "@/domain/json";
import type { WorkspaceData } from "@/domain/types";
import { imageRefOf } from "@/storage/image-storage";
import type { DesktopPreview } from "./desktop";
export const applyDesktop = (
  data: WorkspaceData,
  preview: DesktopPreview,
  useDesktop: Set<string>,
) => {
  if (JSON.stringify(data) !== preview.baseline)
    throw Error(
      "The browser workspace changed after preview. Read the export again.",
    );
  const previousBrowser = jsonObject(parseJson(JSON.stringify(data)));
  data.remote = structuredClone(preview.remote);
  const assigned = { ...cloudData(data).assigned };
  for (const choice of preview.choices)
    if (!choice.conflict || useDesktop.has(choice.id)) {
      const item = data.remote.find((entry) => {
        return entry.id === choice.id;
      });
      if (item) {
        item.assignedState = choice.desktop;
        assigned[item.id] = {
          assignedState: choice.desktop,
          lastState: item.state,
          lastUpdated: item.updated,
          pendingState: null,
        };
      }
    }
  data.cloud = {
    ...cloudData(data),
    assigned,
    autoSync: false,
    rollupPending: false,
  };
  const { order } = preview.source;
  if (order)
    for (const [id, value] of Object.entries(jsonObject(order)))
      if (typeof value === "number" && Number.isSafeInteger(value))
        data.order[id] = value;
  const { images } = preview.source;
  if (images) {
    data.images ??= {};
    for (const [id, value] of Object.entries(jsonObject(images)))
      if (
        typeof value === "string" &&
        /^data:image\/(png|jpeg|gif|webp);base64,/.test(value)
      )
        data.images[id] = imageRefOf(value);
  }
  if (preview.npcdex) {
    data.npcdex = structuredClone(preview.npcdex);
    data.npcdexDrafts = {};
    data.npcdexHistory = [];
    delete data.editorRecovery;
  }
  delete data.view.npcdex;
  data.view.selected = null;
  data.view.scope = null;
  data.migration = {
    importedAt: new Date().toISOString(),
    archive: preview.archive,
    pending: structuredClone(preview.pending),
    reviewed: [],
    previousBrowser,
  };
};
