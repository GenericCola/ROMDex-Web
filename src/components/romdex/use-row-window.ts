import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";
import { rowRange, rowSegments, sameRange, type RowRange } from "./row-window";
import { useStableCallback } from "./use-stable-callback";
// Rows kept above and below the viewport, so Tab, drag auto-scroll and fast wheels find real rows.
const OVERSCAN = 600;
// Before the first measurement (and in server markup) assume this much is visible.
const FIRST_PAINT = 1200;
const DEFAULT_ROW = 37;
const sizesOf = (keys: readonly string[], heights: Map<string, number>) => {
  let total = 0;
  for (const height of heights.values()) total += height;
  const estimate = heights.size ? total / heights.size : DEFAULT_ROW;
  return keys.map((key) => {
    return heights.get(key) ?? estimate;
  });
};
/**
 * Windowed rendering for the task table body. Every rendered row is measured after each commit
 * and when the table resizes; unmeasured rows use the mean measured height. `pinned` entries and
 * the row last pressed or focused (with its neighbours, so Tab reaches the next row) always render.
 */
export const useRowWindow = (keys: readonly string[], pinned: string[]) => {
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const [heights, setHeights] = useState(() => {
    return new Map<string, number>();
  });
  const [range, setRange] = useState<RowRange | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const sizes = sizesOf(keys, heights);
  const at = active === null ? -1 : keys.indexOf(active);
  const pins = pinned.map((key) => {
    return keys.indexOf(key);
  });
  if (at >= 0) pins.push(at - 1, at, at + 1);
  const segments = rowSegments(
    sizes,
    range ?? rowRange(sizes, 0, FIRST_PAINT),
    pins,
  );
  const sync = useStableCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    const shown = segments.filter((segment) => {
      return segment.kind === "row";
    });
    let measured: Map<string, number> | null = null,
      next = 0;
    for (const row of body.rows) {
      if (row.classList.contains("row-gap")) continue;
      const index = shown[next++]?.index;
      const key = index === undefined ? undefined : keys[index];
      const { height } = row.getBoundingClientRect();
      if (key === undefined || height <= 0) continue;
      if (Math.abs((heights.get(key) ?? -1) - height) > 0.5)
        (measured ??= new Map(heights)).set(key, height);
    }
    const port = (
      body.closest(".table-scroll") ?? body
    ).getBoundingClientRect();
    const { top } = body.getBoundingClientRect();
    const visible = rowRange(
      measured ? sizesOf(keys, measured) : sizes,
      Math.max(port.top, 0) - top - OVERSCAN,
      Math.min(port.bottom, innerHeight) - top + OVERSCAN,
    );
    if (measured) setHeights(measured);
    if (!range || !sameRange(range, visible)) setRange(visible);
  });
  const measureRenderedRows = () => {
    sync();
  };
  useLayoutEffect(measureRenderedRows);
  const followScrollAndResize = () => {
    const body = bodyRef.current;
    const table = body?.parentElement;
    const scroller = body?.closest(".table-scroll");
    if (!table || !scroller) return;
    const observer = new ResizeObserver(sync);
    observer.observe(scroller);
    observer.observe(table);
    const options = { capture: true, passive: true };
    document.addEventListener("scroll", sync, options);
    return () => {
      observer.disconnect();
      document.removeEventListener("scroll", sync, options);
    };
  };
  useEffect(followScrollAndResize, [sync]);
  const activate = (event: SyntheticEvent) => {
    const id = (event.target as Element).closest<HTMLElement>("[data-row]")
      ?.dataset.row;
    if (id && id !== active) setActive(id);
  };
  return {
    segments,
    body: { ref: bodyRef, onFocus: activate, onPointerDown: activate },
  };
};
