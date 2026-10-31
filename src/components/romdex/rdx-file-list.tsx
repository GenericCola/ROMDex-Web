import { base64Bytes } from "@/domain/json";
import type { WorkspaceData } from "@/domain/types";
import type { useRdx } from "./use-rdx";
const RdxFileList = ({
  data,
  model,
  mode,
}: {
  data: WorkspaceData;
  mode?: "import" | "export";
  model: Pick<
    ReturnType<typeof useRdx>,
    "busy" | "select" | "openFile" | "download"
  >;
}) => {
  return (
    <>
      {mode !== "export" && (
        <>
          <h3>Desktop RDX files</h3>
          <ul>
            {data.migration?.archive.files
              .filter((file) => {
                return file.name.startsWith("RDX/");
              })
              .map((file) => {
                return (
                  <li key={file.name} className="port-form">
                    {file.name}
                    <button
                      disabled={model.busy}
                      onClick={() => {
                        void model.select(
                          new File(
                            [Uint8Array.from(base64Bytes(file.data))],
                            file.name.split("/").at(-1) ?? "map.rdx",
                          ),
                        );
                      }}
                    >
                      Review {file.name}
                    </button>
                  </li>
                );
              })}
          </ul>
        </>
      )}
      <h3>Retained documents</h3>
      {!data.rdxFiles?.length ? (
        <p>
          {mode === "export"
            ? "No retained RDX documents are available to export in this browser. Import and save a document first."
            : "No RDX files saved in this browser."}
        </p>
      ) : (
        <ul>
          {data.rdxFiles.map((file) => {
            return (
              <li key={file.sha256} className="port-form">
                {file.name} · {file.kind} · {file.revision.slice(0, 12)}
                <div className="port-actions">
                  {mode !== "export" && (
                    <button
                      disabled={model.busy}
                      onClick={() => {
                        model.openFile(file);
                      }}
                    >
                      Inspect {file.name}
                    </button>
                  )}
                  {mode !== "import" && (
                    <button
                      disabled={model.busy}
                      onClick={() => {
                        void model.download(file);
                      }}
                    >
                      Export {file.name}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
};
export default RdxFileList;
