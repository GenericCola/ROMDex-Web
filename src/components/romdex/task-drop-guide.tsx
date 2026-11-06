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
      const left =
        hierarchy.getBoundingClientRect().left -
        viewport.left +
        scroller.scrollLeft +
        Math.max(0, target.depth - scopeDepth) * step;
      guide.style.top = `${(target.after ? bounds.bottom : bounds.top) - viewport.top + scroller.scrollTop}px`;
      guide.style.left = `${left}px`;
      guide.style.width = `${Math.max(24, bounds.right - viewport.left + scroller.scrollLeft - left)}px`;
      guide.hidden = false;
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
