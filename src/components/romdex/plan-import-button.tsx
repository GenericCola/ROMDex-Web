import { mountPlanImports } from "@/domain/accepted/plan-import-view.mjs";
import { flushDraftEditors, registerDraftEditor } from "@/domain/editor-drafts";
import { trackWorkspaceWork } from "@/domain/workspace-work";
import type { BrowserPlanHost } from "@/rdx/plan-host";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { captureItemControls } from "./item-editor-recovery";
import SessionNotice from "./session-notice";
const PlanImportButton = () => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [notice, setNotice] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;
    let flushingOtherEditors = false;
    let host: BrowserPlanHost | null = null,
      disposed = false;
    const loadHost = async () => {
      if (!host) {
        const { BrowserPlanHost: Host } = await import("@/rdx/plan-host");
        host ??= new Host();
        // Unmounted while the module loaded: cancel like the cleanup would.
        if (disposed) host.cancel();
      }
      return host;
    };
    const surface = document.createElement("div");
    setNotice(surface);
    const mounted = mountPlanImports({
      button,
      notice: surface,
      flush: async () => {
        flushingOtherEditors = true;
        try {
          await flushDraftEditors();
        } finally {
          flushingOtherEditors = false;
        }
      },
      api: async (route, input) => {
        let result: unknown;
        await trackWorkspaceWork(async () => {
          result = await (await loadHost()).api(route, input);
        });
        return result;
      },
      onReview: () => {
        document.getElementById("connect-open")?.click();
      },
    });
    const unregister = registerDraftEditor({
      label: "Finish and close the RDX plan review first.",
      dirty: () => {
        return !flushingOtherEditors && mounted.isOpen();
      },
      flush: () => {
        if (mounted.isOpen())
          throw Error(
            "Finish and close the RDX plan review before switching accounts or updating.",
          );
        return Promise.resolve();
      },
      capture: () => {
        return {
          kind: "rdx-plan-editor",
          fields: captureItemControls(
            [
              ...mounted.dialog.querySelectorAll<
                HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
              >("input:not([type=file]),textarea,select"),
            ],
            true,
          ),
        };
      },
    });
    return () => {
      unregister();
      disposed = true;
      host?.cancel();
      mounted.dispose();
    };
  }, []);
  return (
    <>
      <button ref={buttonRef} id="import-plan-rdx">
        Import Plan RDX
      </button>
      {notice && createPortal(<SessionNotice />, notice)}
    </>
  );
};
export default PlanImportButton;
