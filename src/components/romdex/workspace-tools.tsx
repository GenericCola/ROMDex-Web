import { use, useState } from "react";
import Dialog from "./dialog";
import { exportRecovery } from "./recovery-export";
import {
  WorkspaceToolsContext,
  type WorkspaceTool,
} from "./workspace-tools-context";
const WorkspaceTools = () => {
  const choose = use(WorkspaceToolsContext);
  const [open, setOpen] = useState(false);
  const close = () => {
    return setOpen(false);
  };
  // A safety net in every mode; importing stays behind ?recovery=1.
  const handleExportRecovery = () => {
    close();
    exportRecovery();
  };
  const select = (tool: WorkspaceTool) => {
    close();
    choose?.(tool);
  };
  return (
    <>
      <button
        className="workspace-tools-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          return setOpen(true);
        }}
        disabled={!choose}
      >
        TOOLS
      </button>
      {open && (
        <Dialog title="TOOLS" close={close}>
          <div className="workspace-tools-panel">
            <button
              onClick={() => {
                return select("export");
              }}
            >
              EXPORT RDX
            </button>
            <button
              onClick={() => {
                return select("import");
              }}
            >
              IMPORT RDX
            </button>
            <button
              onClick={() => {
                return select("updates");
              }}
            >
              CHECK FOR UPDATES
            </button>
            <button
              onClick={() => {
                return select("install");
              }}
            >
              INSTALL ROMDEX
            </button>
            <button onClick={handleExportRecovery}>EXPORT RECOVERY COPY</button>
          </div>
        </Dialog>
      )}
    </>
  );
};
export default WorkspaceTools;
