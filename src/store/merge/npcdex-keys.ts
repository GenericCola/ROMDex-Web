import type { FlatValues } from "@/store/merge/merge";
import {
  compareText,
  hasId,
  isIdList,
  isObject,
  sortByField,
  type Obj,
} from "@/store/merge/npcdex-shared";

export interface NpcdexState {
  document: Record<string, unknown> | null;
  drafts: Record<string, unknown>;
  history: unknown[];
}

/** Keys of the document that are decomposed into per-entry merge keys. */
const SPLIT = ["towns", "annotations", "changePlans", "history"] as const;
const PLAN_PREFIX = "plans";

export const flattenNpcdex = (state: NpcdexState): FlatValues => {
  const flat: FlatValues = {};
  const doc = state.document;
  if (doc) {
    for (const [field, value] of Object.entries(doc)) {
      if ((field === "towns" || field === "history") && isIdList(value)) {
        flat[`field/${field}`] = true;
        const prefix = field === "towns" ? "town" : "history";
        for (const entry of value) flat[`${prefix}/${entry.id}`] = entry;
      } else if (
        (field === "annotations" || field === "changePlans") &&
        isObject(value)
      ) {
        flat[`field/${field}`] = true;
        const prefix = field === "annotations" ? "annotations" : PLAN_PREFIX;
        for (const [key, entry] of Object.entries(value))
          flat[`${prefix}/${key}`] = entry;
      } else flat[`root/${field}`] = value;
    }
  }
  for (const [key, value] of Object.entries(state.drafts))
    flat[`drafts/${key}`] = value;
  state.history.forEach((entry, index) => {
    flat[`drafthistory/${hasId(entry) ? entry.id : `#${index}`}`] = entry;
  });
  return flat;
};

export const npcdexLayout = (
  document: Obj | null,
): { keys: string[]; towns: string[] } => {
  if (!document) return { keys: [], towns: [] };
  const { towns } = document;
  return {
    keys: Object.keys(document),
    towns: isIdList(towns)
      ? towns.map((town) => {
          return town.id;
        })
      : [],
  };
};

/**
 * Rebuild the NPCDex state. Entries of "annotations" and "changePlans" keep the
 * order in which their keys appear in `flat`, so callers pass a flat map built
 * from the remote side first.
 */
export const unflattenNpcdex = (
  flat: FlatValues,
  layout: { keys: string[]; towns: string[] },
): NpcdexState => {
  const root: Obj = {};
  const towns = new Map<string, unknown>();
  const annotations: Obj = {};
  const plans: Obj = {};
  const history: unknown[] = [];
  const present = new Set<string>();
  const drafts: Obj = {};
  const draftHistory: unknown[] = [];
  let any = false;
  for (const [flatKey, value] of Object.entries(flat)) {
    const slash = flatKey.indexOf("/");
    if (slash < 0) throw new Error(`Invalid NPCDex merge key: ${flatKey}`);
    const prefix = flatKey.slice(0, slash);
    const rest = flatKey.slice(slash + 1);
    if (prefix === "root") {
      root[rest] = value;
      any = true;
    } else if (prefix === "field") {
      if (!SPLIT.includes(rest as (typeof SPLIT)[number]))
        throw new Error(`Invalid NPCDex merge key: ${flatKey}`);
      present.add(rest);
      any = true;
    } else if (prefix === "town") {
      towns.set(rest, value);
      any = true;
    } else if (prefix === "annotations") {
      annotations[rest] = value;
      any = true;
    } else if (prefix === PLAN_PREFIX) {
      plans[rest] = value;
      any = true;
    } else if (prefix === "history") {
      history.push(value);
      any = true;
    } else if (prefix === "drafts") drafts[rest] = value;
    else if (prefix === "drafthistory") draftHistory.push(value);
    else throw new Error(`Unknown NPCDex merge key prefix: ${prefix}`);
  }
  let document: Obj | null = null;
  if (any) {
    const parts: Obj = { ...root };
    if (present.has("towns")) {
      const ordered = layout.towns.filter((id) => {
        return towns.has(id);
      });
      const fresh = [...towns.keys()]
        .filter((id) => {
          return !layout.towns.includes(id);
        })
        .sort(compareText);
      parts.towns = [...ordered, ...fresh].map((id) => {
        return towns.get(id);
      });
    }
    if (present.has("annotations")) parts.annotations = annotations;
    if (present.has("changePlans")) parts.changePlans = plans;
    if (present.has("history"))
      parts.history = sortByField(history, "timestamp");
    document = {};
    const known = layout.keys.filter((key) => {
      return Object.hasOwn(parts, key);
    });
    const fresh = Object.keys(parts)
      .filter((key) => {
        return !layout.keys.includes(key);
      })
      .sort(compareText);
    for (const key of [...known, ...fresh]) document[key] = parts[key];
  }
  return { document, drafts, history: sortByField(draftHistory, "at") };
};
