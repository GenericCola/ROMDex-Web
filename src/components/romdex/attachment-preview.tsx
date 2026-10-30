import { downloadFile } from "@/attachments/download";
import Image from "next/image";
import { useState } from "react";
import Dialog from "./dialog";
import type { FilePreview } from "./use-attachment-preview";
const AttachmentPreview = ({
  file,
  close,
}: {
  file: FilePreview;
  close: () => void;
}) => {
  const [width, setWidth] = useState(640),
    [failed, setFailed] = useState(false);
  return (
    <Dialog
      id="file-preview-dialog"
      title="File Preview"
      close={close}
      desktop
      className="attachments-dialog"
    >
      <p className="muted small">
        {file.name} · {file.size} bytes · Original File · Pixel Art Preview
      </p>
      <div className="file-preview-stage">
        {failed ? (
          <p role="alert">
            Cannot Preview This File. Download it to inspect the original bytes.
          </p>
        ) : (
          <Image
            id="file-preview-image"
            src={file.url}
            alt={file.name}
            unoptimized
            width={width}
            height={width}
            style={{
              width,
              height: "auto",
              maxWidth: "100%",
              imageRendering: "pixelated",
            }}
            onLoad={(event) => {
              setWidth(Math.min(640, event.currentTarget.naturalWidth * 4));
            }}
            onError={() => {
              setFailed(true);
            }}
          />
        )}
      </div>
      <div className="dialog-actions">
        <button onClick={close}>Close</button>
        <button
          className="primary"
          onClick={() => {
            downloadFile(file.blob, file.name);
          }}
        >
          Download Original
        </button>
      </div>
    </Dialog>
  );
};
export default AttachmentPreview;
