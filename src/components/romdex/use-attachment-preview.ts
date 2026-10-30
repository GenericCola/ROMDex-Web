import { previewBlob } from "@/attachments/preview";
import type { Attachment } from "@/attachments/types";
import { uploadStorage } from "@/storage/upload-storage";
import { attachmentReader } from "@/youtrack/attachment-reader";
import { useEffect, useRef, useState } from "react";
import type { useAttachmentWork } from "./use-attachment-work";
export interface FilePreview {
  name: string;
  size: number;
  url: string;
  blob: Blob;
}
export const useAttachmentPreview = (
  id: string,
  work: ReturnType<typeof useAttachmentWork>,
) => {
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const urlRef = useRef<string | null>(null),
    generationRef = useRef({ value: 0 });
  const release = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  };
  const closePreview = () => {
    generationRef.current.value++;
    release();
    setPreview(null);
  };
  useEffect(() => {
    const generation = generationRef.current;
    return () => {
      generation.value++;
      release();
    };
  }, []);
  const show = (blob: Blob, name: string, current: number) => {
    if (generationRef.current.value !== current) return;
    release();
    urlRef.current = URL.createObjectURL(blob);
    setPreview({ blob, name, size: blob.size, url: urlRef.current });
  };
  const view = (file: Attachment) => {
    const current = ++generationRef.current.value;
    work.run(async () => {
      const bytes = await attachmentReader().download(id, file);
      show(previewBlob(bytes, file.mimeType), file.name, current);
    });
  };
  const viewPending = (uploadId: string) => {
    const current = ++generationRef.current.value;
    work.run(async () => {
      const file = await uploadStorage.get(uploadId);
      if (!file)
        throw Error(
          "Queued file bytes are missing. Restore the original file.",
        );
      show(previewBlob(file.blob, file.file.mimeType), file.file.name, current);
    });
  };
  return { preview, closePreview, view, viewPending };
};
