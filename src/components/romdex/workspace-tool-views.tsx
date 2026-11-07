import type { WorkspaceData } from "@/domain/types";
import type { usePwa } from "@components/pwa-controls/use-pwa";
import InstallApp from "./install-app";
import { LazyRdxLibrary, LazyUpdateCheck } from "./lazy-views";
import type { WorkspaceTool } from "./workspace-tools-context";
// The dialog behind each TOOLS menu entry.
const WorkspaceToolViews = ({
  tool,
  data,
  update,
  close,
}: {
  tool: WorkspaceTool;
  data: WorkspaceData;
  update: ReturnType<typeof usePwa>;
  close: () => void;
}) => {
  if (tool === "import" || tool === "export")
    return <LazyRdxLibrary data={data} mode={tool} close={close} />;
  if (tool === "updates")
    return <LazyUpdateCheck update={update} close={close} />;
  return <InstallApp update={update} close={close} />;
};
export default WorkspaceToolViews;
