/** A rendered table entry, or one spacer row standing in for the skipped entries it covers. */
export type RowSegment =
  | { kind: "row"; index: number }
  | { kind: "gap"; from: number; height: number };
export interface RowRange {
  first: number;
  last: number;
}
/** Entries overlapping [top, bottom), in pixels from the start of the first entry. */
export const rowRange = (
  sizes: readonly number[],
  top: number,
  bottom: number,
): RowRange => {
  let offset = 0,
    first = sizes.length,
    last = -1;
  for (const [index, size] of sizes.entries()) {
    if (offset >= bottom) break;
    if (offset + size > top) {
      first = Math.min(first, index);
      last = index;
    }
    offset += size;
  }
  return { first, last };
};
/** Rows in the range plus pinned rows, in order; each run of skipped rows becomes one gap. */
export const rowSegments = (
  sizes: readonly number[],
  range: RowRange,
  pinned: Iterable<number>,
) => {
  const shown = new Set(pinned);
  const segments: RowSegment[] = [];
  let gap: Extract<RowSegment, { kind: "gap" }> | null = null;
  for (const [index, size] of sizes.entries()) {
    if (shown.has(index) || (index >= range.first && index <= range.last)) {
      if (gap) segments.push(gap);
      gap = null;
      segments.push({ kind: "row", index });
    } else if (gap) gap.height += size;
    else gap = { kind: "gap", from: index, height: size };
  }
  if (gap) segments.push(gap);
  return segments;
};
export const sameRange = (left: RowRange, right: RowRange) => {
  return left.first === right.first && left.last === right.last;
};
