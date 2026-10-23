import { base64Bytes, sha256 } from "@/domain/json";
import type { WorkspaceData } from "@/domain/types";
import { readDesktopExport } from "./desktop-export";
export const verifyRetainedAssets = async (data: WorkspaceData) => {
  if (data.migration)
    await readDesktopExport(JSON.stringify(data.migration.archive));
  for (const file of data.rdxFiles ?? []) {
    const bytes = base64Bytes(file.data);
    if (bytes.length !== file.bytes || (await sha256(bytes)) !== file.sha256)
      throw Error(
        "A retained RDX file failed its checksum. The workspace has not been replaced.",
      );
  }
};
