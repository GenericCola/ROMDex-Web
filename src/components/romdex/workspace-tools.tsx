import { use, useState } from "react";
import Dialog from "./dialog";
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
          </div>
        </Dialog>
      )}
    </>
  );
};
export default WorkspaceTools;
