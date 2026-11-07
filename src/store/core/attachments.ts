import type { EncodedPart } from "../parts/files.ts";
import { articleId, record } from "./article.ts";
import type { StoreTransport } from "./transport.ts";

export interface ArticleAttachment {
  id: string;
  name: string;
  size: number;
  url: string;
}

const ATTACHMENT_FIELDS = "id,name,size,url,removed";

const toAttachment = (value: unknown): ArticleAttachment | null => {
  const raw = record(value);
  if (
    typeof raw?.id !== "string" ||
    typeof raw.name !== "string" ||
    typeof raw.size !== "number" ||
    raw.removed === true
  )
    return null;
  return {
    id: raw.id,
    name: raw.name,
    size: raw.size,
    url: typeof raw.url === "string" ? raw.url : "",
  };
};

export const readAttachment = async (
  transport: StoreTransport,
  article: string,
  id: string,
) => {
  if (!/^[\w-]{1,100}$/.test(id)) throw Error("Invalid attachment id.");
  return toAttachment(
    await transport.request(
      `articles/${articleId(article)}/attachments/${id}?fields=${ATTACHMENT_FIELDS}`,
    ),
  );
};

export const listAttachments = async (
  transport: StoreTransport,
  article: string,
): Promise<ArticleAttachment[]> => {
  const files: ArticleAttachment[] = [];
  for (let skip = 0; skip < 20000; skip += 100) {
    const page = await transport.request(
      `articles/${articleId(article)}/attachments?fields=${ATTACHMENT_FIELDS}&$top=100&$skip=${skip}`,
    );
    if (!Array.isArray(page)) throw Error("Invalid attachment listing.");
    for (const value of page) {
      const file = toAttachment(value);
      if (file) files.push(file);
    }
    if (page.length < 100) return files;
  }
  throw Error("The article has too many attachments to list.");
};

/** Uploads one part as a new attachment and answers its id. */
export const uploadPart = async (
  transport: StoreTransport,
  article: string,
  part: EncodedPart,
): Promise<string> => {
  const form = new FormData();
  form.append(
    "upload",
    new Blob([Uint8Array.from(part.bytes)], {
      type: part.type ?? "application/octet-stream",
    }),
    part.name,
  );
  const response = await transport.request(
    `articles/${articleId(article)}/attachments?fields=id,name,size`,
    "POST",
    form,
  );
  const list: unknown[] = Array.isArray(response) ? response : [response];
  const [created] = list;
  const file = toAttachment(created);
  if (list.length !== 1 || file?.size !== part.size)
    throw Error(
      `The upload of "${part.name}" has no exact receipt. Nothing else was changed.`,
    );
  return file.id;
};
