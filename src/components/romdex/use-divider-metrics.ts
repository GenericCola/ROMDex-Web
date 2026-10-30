import type { WorkspaceData } from "@/domain/types";
import { useLayoutEffect, useRef, useState } from "react";
import { measureTray } from "./tray-measurement";
export const useDividerMetrics = (view: WorkspaceData["view"]) => {
  const ref = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState({
    percent: view.workHeight,
    text: "",
  });
  useLayoutEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    const measure = () => {
      const layout = measureTray(host, view);
      const percent = layout.available
        ? Math.round((layout.work / layout.available) * 100)
        : 0;
      const text =
        view.detailsMode === "collapsed"
          ? "Details Collapsed. Drag Up to Reopen."
          : `Work ${Math.round(layout.work)} Pixels; Details ${Math.round(layout.available - layout.work)} Pixels`;
      setMetrics((current) => {
        return current.percent === percent && current.text === text
          ? current
          : { percent, text };
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    const work = host.querySelector("#work-tray");
    if (work) observer.observe(work);
    return () => {
      return observer.disconnect();
    };
  }, [view]);
  return { ref, ...metrics };
};
