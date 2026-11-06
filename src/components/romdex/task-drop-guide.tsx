import type { DropTarget } from "@/domain/task-drop";
import { useLayoutEffect, useRef } from "react";

const TaskDropGuide = ({
  target,
  scopeDepth,
}: {
  target: DropTarget | null;
  scopeDepth: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const guide = ref.current;
    const scroller = guide?.parentElement;
    if (!guide || !scroller || !target || target.selectorId) return;
    const position = () => {
      const row = [
        ...scroller.querySelectorAll<HTMLElement>("[data-row]"),
      ].find((candidate) => {
        return candidate.dataset.row === target.anchorId;
      });
      const hierarchy = row?.querySelector<HTMLElement>(".row-hierarchy");
      if (!row || !hierarchy) {
        guide.hidden = true;
        return;
      }
      const bounds = row.getBoundingClientRect();
      const viewport = scroller.getBoundingClientRect();
      const styles = getComputedStyle(scroller);
      const step =
        parseFloat(styles.getPropertyValue("--hierarchy-step")) || 21;
      const left = Math.max(
        viewport.left,
        hierarchy.getBoundingClientRect().left +
          Math.max(0, target.depth - scopeDepth) * step,
      );
      const right = viewport.left + scroller.clientLeft + scroller.clientWidth;
      const top = target.after ? bounds.bottom : bounds.top;
      const header = scroller.querySelector("thead")?.getBoundingClientRect();
      // A fixed overlay preserves the exact boundary without being clipped by
      // the scroll viewport when its last visible row touches the footer.
      guide.style.top = `${top}px`;
      guide.style.left = `${left}px`;
      guide.style.width = `${Math.max(0, Math.min(bounds.right, right) - left)}px`;
      guide.hidden =
        top < (header?.bottom ?? viewport.top) ||
        top > viewport.bottom + 2 ||
        left >= right;
    };
    position();
    scroller.addEventListener("scroll", position);
    window.addEventListener("resize", position);
    return () => {
      scroller.removeEventListener("scroll", position);
      window.removeEventListener("resize", position);
    };
  }, [target, scopeDepth]);
  return target && !target.selectorId ? (
    <div ref={ref} className="drop-guide" aria-hidden="true" />
  ) : null;
};
export default TaskDropGuide;
