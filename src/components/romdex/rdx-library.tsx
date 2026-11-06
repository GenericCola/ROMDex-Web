import type { WorkspaceData } from "@/domain/types";
import { nodes } from "@/npcdex/model";
import Dialog from "./dialog";
import Pending from "./pending";
import RdxFileList from "./rdx-file-list";
import RdxPreview from "./rdx-preview";
import { useRdx } from "./use-rdx";
const RdxLibrary = ({
  data,
  close,
  mode,
}: {
  data: WorkspaceData;
  close: () => void;
  mode?: "import" | "export";
}) => {
  const model = useRdx(),
    conflicts = model.value?.preview
      ? nodes(model.value.preview, "conflicts")
      : [],
    ready = conflicts.every((conflict) => {
      return !!conflict.choice;
    });
  return (
    <Dialog
      title={
        mode === "export"
          ? "EXPORT RDX"
          : mode === "import"
            ? "IMPORT RDX"
            : "RDX Files"
      }
      close={close}
      className="rdx-plan-dialog rdx-browser-dialog"
    >
      <div className="rdx-library-body">
        <p>
          {mode === "export"
            ? "Choose a retained RDX document to export with its portable history and assets. This exports the selected document, not your entire PMON workspace."
            : "Import maps and task plans into this browser. Source files and earlier document revisions are retained. Review the validated file before saving."}
        </p>
        {mode !== "export" && (
          <label>
            RDX file
            <input
              type="file"
              accept=".rdx"
              disabled={model.busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void model.select(file);
                event.target.value = "";
              }}
            />
          </label>
        )}
        <Pending
          active={model.busy}
          label={model.label}
          message={model.message}
        />
        {mode !== "export" && model.value && (
          <RdxPreview
            value={model.value}
            choices={model.choices}
            choose={model.choose}
          />
        )}
        <RdxFileList data={data} model={model} {...(mode ? { mode } : {})} />
      </div>
      <footer>
        {mode !== "export" && model.value && (
          <>
            <label className="port-check-line">
              <input
                type="checkbox"
                checked={model.confirmed}
                disabled={model.busy || !ready}
                onChange={(event) => {
                  model.setConfirmed(event.target.checked);
                }}
              />
              I reviewed this file and preserved my recovery copy. Opening a map
              retains the preceding workspace in recovery history.
            </label>
            <button
              disabled={model.busy || !ready || !model.confirmed}
              onClick={() => {
                void model.save();
              }}
            >
              Save RDX in Browser
            </button>
            {model.value.projection && (
              <button
                disabled={model.busy || !ready || !model.confirmed}
                onClick={() => {
                  void model.save(true);
                }}
              >
                Open Map in NPCDex
              </button>
            )}
          </>
        )}
        <button onClick={close}>Close</button>
      </footer>
    </Dialog>
  );
};
export default RdxLibrary;
