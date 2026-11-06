import type { StoreTransport } from "../../src/store/core/transport.ts";
import {
  articleView,
  attachmentView,
  uploadFile,
} from "./fake-youtrack-views.tsx";

/*
 * An in-memory YouTrack for the store core. It knows articles and their
 * attachments, bumps `updated` on every content write and upload like the real
 * one, and has no DELETE at all.
 */

export interface FakeAttachment {
  id: string;
  name: string;
  bytes: Uint8Array;
}

export interface FakeArticle {
  id: string;
  idReadable: string;
  summary: string;
  content: string;
  updated: number;
  projectId: string;
  visibility: unknown;
  attachments: FakeAttachment[];
}

export interface FakeCall {
  method: string;
  path: string;
}

const asRecord = (value: unknown): Record<string, unknown> => {
  return (value ?? {}) as Record<string, unknown>;
};

export class FakeYouTrackStore {
  articles = new Map<string, FakeArticle>();
  calls: FakeCall[] = [];
  downloads: string[] = [];
  onBeforeContentWrite: (() => void) | undefined;
  onAfterContentWrite: (() => void) | undefined;
  failNextUpload = false;
  private clock = 1000;
  private counter = 0;

  private tick = () => {
    this.clock += 1;
    return this.clock;
  };

  addArticle = (
    summary: string,
    content: string,
    projectId: string,
  ): FakeArticle => {
    this.counter += 1;
    const article: FakeArticle = {
      id: `181-${this.counter}`,
      idReadable: `TST-A-${this.counter}`,
      summary,
      content,
      updated: this.tick(),
      projectId,
      visibility: null,
      attachments: [],
    };
    this.articles.set(article.id, article);
    return article;
  };

  setContent = (id: string, content: string) => {
    const article = this.need(id);
    article.content = content;
    article.updated = this.tick();
  };

  /** Replaces the stored bytes of an attachment, keeping its size. */
  corrupt = (id: string, attachmentId: string) => {
    const file = this.need(id).attachments.find((a) => {
      return a.id === attachmentId;
    });
    if (!file) throw Error("No such attachment.");
    file.bytes = file.bytes.map((byte, at) => {
      return at === 0 ? byte ^ 255 : byte;
    });
  };

  count = (method: string, pattern: RegExp) => {
    return this.calls.filter((call) => {
      return call.method === method && pattern.test(call.path);
    }).length;
  };

  private need = (id: string) => {
    const article = this.articles.get(id);
    if (!article) throw Error(`No article ${id}.`);
    return article;
  };

  private list = (url: URL) => {
    const text = /\{(.*)\}/.exec(url.searchParams.get("query") ?? "")?.[1];
    return [...this.articles.values()]
      .filter((a) => {
        return text === undefined || a.summary.includes(text);
      })
      .map(articleView);
  };

  private onArticle = async (
    id: string,
    rest: string[],
    method: string,
    url: URL,
    body: unknown,
  ) => {
    const article = this.articles.get(id);
    if (!article) return null;
    const [kind, attachmentId] = rest;
    if (kind === undefined) {
      if (method === "GET") return articleView(article);
      this.onBeforeContentWrite?.();
      article.content = String(asRecord(body).content);
      article.updated = this.tick();
      this.onAfterContentWrite?.();
      return {};
    }
    if (kind !== "attachments") throw Error(`Unknown route ${url.pathname}.`);
    if (method === "POST") {
      if (this.failNextUpload) {
        this.failNextUpload = false;
        throw Error("YouTrack answered 500 to POST attachments.");
      }
      return uploadFile(article, body, this.tick());
    }
    if (attachmentId !== undefined) {
      const file = article.attachments.find((a) => {
        return a.id === attachmentId;
      });
      return file ? attachmentView(id, file) : null;
    }
    const top = Number(url.searchParams.get("$top") ?? 100);
    const skip = Number(url.searchParams.get("$skip") ?? 0);
    return article.attachments.slice(skip, skip + top).map((file) => {
      return attachmentView(id, file);
    });
  };

  private create = (body: unknown) => {
    const data = asRecord(body);
    const article = this.addArticle(
      String(data.summary),
      String(data.content),
      String(asRecord(data.project).id),
    );
    article.visibility = data.visibility;
    return articleView(article);
  };

  request: StoreTransport["request"] = async (route, method = "GET", body) => {
    if (method === "DELETE") throw Error("DELETE is not supported.");
    const url = new URL(route, "https://fake.invalid/api/");
    const path = url.pathname.replace(/^\/api\//, "");
    this.calls.push({ method, path });
    const [root, id, ...rest] = path.split("/");
    if (root !== "articles") throw Error(`Unknown route ${path}.`);
    if (id === undefined)
      return method === "POST" ? this.create(body) : this.list(url);
    return this.onArticle(id, rest, method, url, body);
  };

  download: StoreTransport["download"] = (url, size, target) => {
    const file = this.need(target.article).attachments.find((a) => {
      return a.id === target.id;
    });
    if (!file || !url.includes(`/api/files/${file.id}`))
      throw Error("Unknown attachment.");
    this.downloads.push(file.id);
    if (file.bytes.length !== size) throw Error("Wrong attachment size.");
    return Promise.resolve(file.bytes.slice());
  };
}
