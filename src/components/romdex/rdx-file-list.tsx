import { base64Bytes } from "@/domain/json";
import type { WorkspaceData } from "@/domain/types";
import type { useRdx } from "./use-rdx";
const RdxFileList = ({
  data,
  model,
}: {
  data: WorkspaceData;
  model: Pick<
    ReturnType<typeof useRdx>,
    "busy" | "select" | "openFile" | "download"
  >;
}) => {
  return (
    <>
      <h3>Desktop RDX files</h3>
      <ul>
        {data.migration?.archive.files
          .filter((file) => {
            return file.name.startsWith("RDX/");
          })
          .map((file) => {
            return (
              <li key={file.name}>
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
      <h3>Retained documents</h3>
      {!data.rdxFiles?.length ? (
        <p>No RDX files saved in this browser.</p>
      ) : (
        <ul>
          {data.rdxFiles.map((file) => {
            return (
              <li key={file.sha256}>
                {file.name} · {file.kind} · {file.revision.slice(0, 12)}
                <button
                  disabled={model.busy}
                  onClick={() => {
                    model.openFile(file);
                  }}
                >
                  Inspect {file.name}
                </button>
                <button
                  disabled={model.busy}
                  onClick={() => {
                    void model.download(file);
                  }}
                >
                  Export {file.name}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
};
export default RdxFileList;
