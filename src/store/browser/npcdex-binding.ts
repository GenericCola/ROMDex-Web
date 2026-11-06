import type { JsonObject } from "@/domain/json";
import type { WorkspaceData } from "@/domain/types";
import type { NpcdexDraft } from "@/npcdex/model";
import {
  flattenNpcdex,
  npcdexLayout,
  unflattenNpcdex,
  type NpcdexState,
} from "@/store/merge";
import type { PartValue } from "../parts/files.ts";
import { npcdexToParts } from "../parts/npcdex-parts.ts";
import { partsToNpcdex } from "../parts/npcdex-restore.ts";
import type { StoreBinding } from "./binding.ts";

interface Layout {
  keys: string[];
  towns: string[];
}

const decode = (parts: PartValue[]): NpcdexState => {
  if (parts.length === 0) return { document: null, drafts: {}, history: [] };
  const { document, drafts } = partsToNpcdex(parts);
  return {
    document,
    drafts: drafts?.drafts ?? {},
    history: drafts?.history ?? [],
  };
};

const localState = (data: WorkspaceData): NpcdexState => {
  return {
    document: data.npcdex ?? null,
    drafts: data.npcdexDrafts ?? {},
    history: data.npcdexHistory ?? [],
  };
};

const union = (first: string[], second: string[]) => {
  return [
    ...first,
    ...second.filter((entry) => {
      return !first.includes(entry);
    }),
  ];
};

/** Remote order first, then keys only this browser has. */
const layoutOf = (remoteParts: PartValue[], data: WorkspaceData): Layout => {
  const remote = npcdexLayout(decode(remoteParts).document);
  const local = npcdexLayout(data.npcdex ?? null);
  return {
    keys: union(remote.keys, local.keys),
    towns: union(remote.towns, local.towns),
  };
};

const isDraftKey = (key: string) => {
  return key.startsWith("drafts/") || key.startsWith("drafthistory/");
};

export const npcdexBinding: StoreBinding = {
  store: "npcdex",
  ready: () => {
    return null;
  },
  remote: (parts) => {
    return flattenNpcdex(decode(parts));
  },
  local: (data, base, remote) => {
    const flat = flattenNpcdex(localState(data));
    if (data.npcdex) return flat;
    for (const [key, value] of Object.entries(base ?? remote))
      if (!isDraftKey(key)) flat[key] = value;
    return flat;
  },
  parts: async (merged, remoteParts, data): Promise<PartValue[]> => {
    const state = unflattenNpcdex(merged, layoutOf(remoteParts, data));
    const hasDrafts =
      Object.keys(state.drafts).length > 0 || state.history.length > 0;
    if (state.document === null && !hasDrafts) return [];
    return npcdexToParts(state.document ?? {}, {
      drafts: state.drafts,
      history: state.history,
    });
  },
  apply: (data, values, keys, remoteParts) => {
    const flat = flattenNpcdex(localState(data));
    for (const key of keys) {
      if (Object.hasOwn(values, key)) flat[key] = values[key];
      else delete flat[key];
    }
    const state = unflattenNpcdex(flat, layoutOf(remoteParts, data));
    if (state.document !== null) data.npcdex = state.document as JsonObject;
    data.npcdexDrafts = state.drafts as Record<string, NpcdexDraft>;
    data.npcdexHistory = state.history as JsonObject[];
    return [];
  },
};
