import type { FakeArticle, FakeAttachment } from "./fake-youtrack-store.tsx";

export const articleView = (article: FakeArticle) => {
  return {
    id: article.id,
    idReadable: article.idReadable,
    summary: article.summary,
    content: article.content,
    updated: article.updated,
    project: { id: article.projectId },
  };
};

export const attachmentView = (id: string, file: FakeAttachment) => {
  return {
    id: file.id,
    name: file.name,
    size: file.bytes.length,
    url: `/api/files/${file.id}?sign=x`,
    removed: false,
    article: id,
  };
};

/** Stores the "upload" form field as a new attachment; `now` is the new updated time. */
export const uploadFile = async (
  article: FakeArticle,
  body: unknown,
  now: number,
) => {
  const upload = body instanceof FormData ? body.get("upload") : null;
  if (!(upload instanceof Blob) || !("name" in upload))
    throw Error("Upload needs a named file.");
  const file: FakeAttachment = {
    id: `${article.id}-f${article.attachments.length + 1}`,
    name: String(upload.name),
    bytes: new Uint8Array(await upload.arrayBuffer()),
  };
  article.attachments.push(file);
  article.updated = now;
  return [{ id: file.id, name: file.name, size: file.bytes.length }];
};
