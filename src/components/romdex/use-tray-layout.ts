import type { WorkspaceData } from "@/domain/types";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { measureTray } from "./tray-measurement";
export const useTrayLayout = (view: WorkspaceData["view"]) => {
  const ref = useRef<HTMLElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;
    const measure = () => {
      setHeight(measureTray(host, view).work);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    for (const selector of [
      ".work-header",
      ".work-footer",
      ".notice",
      "thead",
    ]) {
      const element = host.querySelector(selector);
      if (element) observer.observe(element);
    }
    return () => {
      observer.disconnect();
    };
  }, [view]);
  return {
    ref,
    style: {
      "--work-height": height === null ? view.workHeight + "%" : height + "px",
    } as CSSProperties,
  };
};
