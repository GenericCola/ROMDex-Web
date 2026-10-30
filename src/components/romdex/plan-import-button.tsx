import { mountPlanImports } from "@/domain/accepted/plan-import-view.mjs";
import { flushDraftEditors, registerDraftEditor } from "@/domain/editor-drafts";
import { trackWorkspaceWork } from "@/domain/workspace-work";
import { BrowserPlanHost } from "@/rdx/plan-host";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import SessionNotice from "./session-notice";
const PlanImportButton = () => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [notice, setNotice] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;
    let flushingOtherEditors = false;
    const host = new BrowserPlanHost(),
      surface = document.createElement("div");
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
          result = await host.api(route, input);
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
          fields: [
            ...mounted.dialog.querySelectorAll<
              HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
            >("input:not([type=file]),textarea,select"),
          ].map((control) => {
            return {
              label:
                control.getAttribute("aria-label") ??
                control.closest("label")?.textContent ??
                "Plan field",
              value: control.value,
            };
          }),
        };
      },
    });
    return () => {
      unregister();
      host.cancel();
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
