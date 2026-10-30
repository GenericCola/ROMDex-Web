import Image from "next/image";
import { useState, type ReactNode } from "react";
import Dialog from "./dialog";
const WorkspaceTools = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const show = () => {
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
  };
  return (
    <>
      <button
        className="suite-settings-slot"
        aria-label="Workspace tools"
        title="Workspace tools"
        onClick={show}
      >
        <Image
          src="/romdex/standard-settings-icon.svg"
          width={12}
          height={12}
          alt=""
        />
      </button>
      <Dialog title="Workspace tools" close={close} open={open}>
        <div className="workspace-tools-panel">{children}</div>
      </Dialog>
    </>
  );
};
export default WorkspaceTools;
