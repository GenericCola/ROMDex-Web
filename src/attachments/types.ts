export interface UploadFile {
  name: string;
  size: number;
  mimeType: string;
  hash: string;
}
export interface Attachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  created: number;
  updated: number;
  authorId: string;
}
export interface StoredUpload {
  id: string;
  file: UploadFile;
  blob: Blob;
}
export type AttachmentOperation =
  | {
      opId: string;
      issueId: string;
      type: "attachment";
      uploadId: string;
      file: UploadFile;
    }
  | {
      opId: string;
      issueId: string;
      type: "attachment-delete";
      attachmentId: string;
      base: Attachment;
    };
export interface AttachmentPort {
  requireUploadSize?: (size: number) => void;
  list: (issue: string) => Promise<Attachment[]>;
  upload: (issue: string, value: StoredUpload) => Promise<{ id: string }>;
  download: (issue: string, attachment: Attachment) => Promise<Uint8Array>;
  remove: (issue: string, id: string) => Promise<void>;
}
export interface UploadStore {
  get: (id: string) => Promise<StoredUpload | undefined>;
  put: (value: StoredUpload) => Promise<void>;
  remove: (id: string) => Promise<void>;
}
