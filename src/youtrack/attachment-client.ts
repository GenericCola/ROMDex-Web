import type {
  Attachment,
  AttachmentPort,
  StoredUpload,
} from "@/attachments/types";
import {
  requireCloudUploadSize,
  sameAttachment,
  validateAttachment,
} from "@/attachments/validate";
import { attachmentBytes } from "./attachment-bytes";
import type { YouTrackRequest } from "./request";
import { issueId } from "./request";
interface RawAttachment extends Omit<Attachment, "authorId"> {
  author?: { id?: string };
  url?: string;
  removed?: boolean;
  draft?: boolean;
}
const fields = "id,name,size,mimeType,created,updated,author(id),removed,draft";
const normalized = (raw: RawAttachment): Attachment => {
  const value = {
    id: raw.id,
    name: raw.name,
    size: raw.size,
    mimeType: raw.mimeType || "application/octet-stream",
    created: raw.created,
    updated: raw.updated,
    authorId: raw.author?.id ?? "",
  };
  validateAttachment(value);
  return value;
};
export class AttachmentClient implements AttachmentPort {
  private bytes: ReturnType<typeof attachmentBytes>;
  constructor(
    private request: YouTrackRequest,
    token: string,
  ) {
    this.bytes = attachmentBytes(token);
  }
  list = async (issue: string) => {
    const values: RawAttachment[] = [];
    for (let skip = 0; skip <= 1000; skip += 100) {
      const page = await this.request(
        "issues/" +
          issueId(issue) +
          "/attachments?fields=" +
          fields +
          "&$top=100&$skip=" +
          skip,
      );
      if (!Array.isArray(page) || page.length > 100)
        throw Error("Invalid attachment listing.");
      values.push(...(page as RawAttachment[]));
      if (values.length > 1000)
        throw Error(
          "Attachment inventory exceeds 1,000 files. No file mutation was sent.",
        );
      if (page.length < 100) break;
    }
    const current = values
      .filter((file) => {
        return !file.removed && !file.draft;
      })
      .map(normalized);
    if (
      new Set(
        current.map((file) => {
          return file.id;
        }),
      ).size !== current.length
    )
      throw Error("Attachment inventory changed. Read it again.");
    return current;
  };
  upload = async (issue: string, value: StoredUpload) => {
    requireCloudUploadSize(value.file.size);
    const form = new FormData();
    form.append(
      "upload",
      new Blob([value.blob], { type: value.file.mimeType }),
      value.file.name,
    );
    const response = await this.request(
      "issues/" + issueId(issue) + "/attachments?fields=id",
      "POST",
      form,
    );
    if (
      !Array.isArray(response) ||
      response.length !== 1 ||
      !response[0] ||
      typeof (response[0] as { id?: unknown }).id !== "string"
    )
      throw Error(
        "The upload has no exact receipt. Review before sending anything else.",
      );
    return { id: (response[0] as { id: string }).id };
  };
  download = async (issue: string, expected: Attachment) => {
    const raw = (await this.request(
      "issues/" +
        issueId(issue) +
        "/attachments/" +
        encodeURIComponent(expected.id) +
        "?fields=" +
        fields +
        ",url",
    )) as RawAttachment | null;
    if (
      !raw ||
      raw.removed ||
      raw.draft ||
      !sameAttachment(normalized(raw), expected) ||
      typeof raw.url !== "string"
    )
      throw Error(
        "The attachment changed or is unreadable. Refresh its metadata before downloading.",
      );
    return this.bytes(raw.url, expected.size);
  };
  remove = async (issue: string, id: string) => {
    await this.request(
      "issues/" + issueId(issue) + "/attachments/" + encodeURIComponent(id),
      "DELETE",
    );
  };
}
