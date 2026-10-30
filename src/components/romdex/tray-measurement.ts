import { defaultTrayHeight, trayLayout } from "@/domain/tray-layout";
import type { WorkspaceData } from "@/domain/types";
const pixels = (style: CSSStyleDeclaration, key: string) => {
  return Number.parseFloat(style.getPropertyValue(key)) || 0;
};
export const measureTray = (host: HTMLElement, view: WorkspaceData["view"]) => {
  const hostHeight = host.getBoundingClientRect().height;
  const viewportHeight =
    Number.parseFloat(
      document.documentElement.style.getPropertyValue("--app-height"),
    ) || innerHeight;
  const defaultHeight = defaultTrayHeight(
    hostHeight,
    innerWidth,
    viewportHeight,
  );
  const work = host.querySelector<HTMLElement>("#work-tray");
  const table = work?.querySelector<HTMLElement>(".table-scroll");
  if (!work || !table) return trayLayout(view, hostHeight, 240, defaultHeight);
  const frameStyle = getComputedStyle(work),
    tableStyle = getComputedStyle(table);
  const height = (selector: string) => {
    return work.querySelector<HTMLElement>(selector)?.offsetHeight ?? 0;
  };
  const notice = work.querySelector<HTMLElement>(".notice");
  const noticeStyle =
    notice && !notice.hidden ? getComputedStyle(notice) : null;
  const noticeHeight =
    noticeStyle && notice
      ? notice.offsetHeight +
        pixels(noticeStyle, "margin-top") +
        pixels(noticeStyle, "margin-bottom")
      : 0;
  const minimum =
    height(".work-header") +
    height(".work-footer") +
    height("thead") +
    50 +
    noticeHeight +
    pixels(tableStyle, "padding-top") +
    pixels(tableStyle, "padding-bottom") +
    pixels(frameStyle, "border-top-width") +
    pixels(frameStyle, "border-bottom-width") +
    pixels(frameStyle, "padding-top") +
    pixels(frameStyle, "padding-bottom");
  return trayLayout(view, hostHeight, Math.max(220, minimum), defaultHeight);
};
