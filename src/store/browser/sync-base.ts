import type { CommitResult } from "@/store/core/write";
import type { FlatValues, MergeResult } from "@/store/merge/merge";

const restore = (values: FlatValues, from: FlatValues | null, key: string) => {
  if (from && Object.hasOwn(from, key)) values[key] = from[key];
  else delete values[key];
};

/** The merge base saved after a sync: what both sides now hold. */
export const nextBase = (
  base: FlatValues | null,
  result: MergeResult,
  remote: FlatValues,
  commit: CommitResult,
  later: string[],
) => {
  const values = { ...result.merged };
  // A refused part was not stored: its local changes stay pending.
  if (
    commit.kind !== "moved" &&
    commit.kind !== "lost" &&
    commit.refused.length
  )
    for (const key of result.toRemote) restore(values, remote, key);
  // Keys not applied here keep the old base, so the next sync applies them.
  for (const key of later) restore(values, base, key);
  return values;
};
