import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { StoreArticle } from "../../src/store/core/article.ts";
import { createArticle } from "../../src/store/core/article.ts";
import { readStore } from "../../src/store/core/read.ts";
import { STORE_TARGETS } from "../../src/store/core/transport.ts";
import { commitStore } from "../../src/store/core/write.ts";
import type { PartValue } from "../../src/store/parts/files.ts";
import type { RomdexMetadata } from "../../src/store/parts/romdex-parts.ts";
import {
  metadataToParts,
  partsToMetadata,
} from "../../src/store/parts/romdex-parts.ts";
import { FakeYouTrackStore } from "../fixtures/fake-youtrack-store.tsx";
import { APP } from "./cookie-fixture";

/*
 * One in-memory YouTrack (the unit tests' fake) served to any number of pages
 * through the app's own proxy URLs. Only article routes and article downloads
 * are answered; everything else falls through to the page's other routes.
 */

export interface StoreWrite {
  method: string;
  /** The route after `api/`, e.g. `articles/181-1?fields=id`. */
  route: string;
  /** JSON body, or `{ file, size }` for an upload. */
  body?: unknown;
}

export interface StoreHost {
  fake: FakeYouTrackStore;
  /** Every non-GET request that reached the store, in order. */
  writes: StoreWrite[];
}

export const newStoreHost = (): StoreHost => {
  return { fake: new FakeYouTrackStore(), writes: [] };
};

const parseBody = async (
  contentType: string,
  buffer: Buffer | null,
): Promise<{ body: unknown; summary: unknown }> => {
  if (!buffer) return { body: undefined, summary: undefined };
  if (contentType.includes("multipart/form-data")) {
    const form = await new Request("http://store.invalid/", {
      method: "POST",
      headers: { "content-type": contentType },
      body: new Uint8Array(buffer),
    }).formData();
    const upload = form.get("upload");
    return {
      body: form,
      summary:
        upload instanceof File
          ? { file: upload.name, size: upload.size }
          : undefined,
    };
  }
  const json: unknown = JSON.parse(buffer.toString("utf8"));
  return { body: json, summary: json };
};

/** Serves the host's fake to `page`. Register after the page's other fixtures. */
export const serveStore = async (page: Page, host: StoreHost) => {
  await page.route(APP + "/api/youtrack?*", async (route) => {
    const request = route.request();
    const target = new URL(request.url()).searchParams.get("route") ?? "";
    if (!target.startsWith("articles")) return route.fallback();
    const method = request.method();
    if (method === "DELETE") {
      host.writes.push({ method, route: target });
      return route.fulfill({ status: 405, body: "DELETE is not allowed." });
    }
    try {
      const { body, summary } = await parseBody(
        request.headers()["content-type"] ?? "",
        request.postDataBuffer(),
      );
      if (method !== "GET")
        host.writes.push({
          method,
          route: target,
          ...(summary === undefined ? {} : { body: summary }),
        });
      const result = await host.fake.request(target, method, body);
      if (result === null && method === "GET")
        return route.fulfill({ status: 404, body: "" });
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(result ?? {}),
      });
    } catch (error) {
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: error instanceof Error ? error.message : "Store error",
        }),
      });
    }
  });
  await page.route(APP + "/api/attachment?*", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    const article = params.get("article"),
      id = params.get("id");
    if (!article || !id) return route.fallback();
    try {
      const bytes = await host.fake.download(
        `/api/files/${id}?sign=x`,
        Number(params.get("size")),
        { article, id },
      );
      return route.fulfill({
        status: 200,
        contentType: "application/octet-stream",
        body: Buffer.from(bytes),
      });
    } catch {
      return route.fulfill({ status: 404, body: "" });
    }
  });
};

const ROMDEX = STORE_TARGETS["romdex-metadata"];

export const metadataOf = (
  part: Partial<RomdexMetadata> = {},
): RomdexMetadata => {
  return { version: 1, images: {}, orders: {}, assigned: {}, ...part };
};

/** Creates the "ROMDex data" article the way the app would and fills it, as another device. */
export const seedRomdex = async (
  host: StoreHost,
  metadata: Partial<RomdexMetadata>,
) => {
  const created = await createArticle(host.fake, ROMDEX, "2-9");
  const base = await readStore(host.fake, created, ROMDEX.store);
  const parts: PartValue[] = metadataToParts(metadataOf(metadata));
  const result = await commitStore(host.fake, {
    base,
    parts,
    writtenBy: "2-9",
  });
  if (result.kind !== "written") throw Error("Seeding was not written.");
  host.fake.calls.length = 0;
  host.writes.length = 0;
  return created.id;
};

/** The ROMDex data article as stored now, read through the real store code. */
export const readRomdex = async (host: StoreHost) => {
  const stored = [...host.fake.articles.values()].find((article) => {
    return article.summary === ROMDEX.title;
  });
  if (!stored) return null;
  const article: StoreArticle = {
    id: stored.id,
    idReadable: stored.idReadable,
    summary: stored.summary,
    content: stored.content,
    updated: stored.updated,
    projectId: stored.projectId,
  };
  const snapshot = await readStore(host.fake, article, ROMDEX.store);
  return {
    revision: snapshot.manifest.revision,
    files: snapshot.manifest.files,
    metadata: partsToMetadata(snapshot.parts),
  };
};

/** Writes to the article body (not uploads, not creation). */
export const contentWrites = (host: StoreHost) => {
  return host.writes.filter((write) => {
    return write.method === "POST" && /^articles\/[^/?]+\?/.test(write.route);
  });
};

export const uploadsOf = (host: StoreHost) => {
  return host.writes.filter((write) => {
    return write.method === "POST" && write.route.includes("/attachments");
  });
};

const productionHeaders = () => {
  const config = JSON.parse(readFileSync(resolve("vercel.json"), "utf8")) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  const entry = config.headers.find((item) => {
    return item.source === "/";
  });
  if (!entry) throw Error("vercel.json has no headers for /.");
  return Object.fromEntries(
    entry.headers.map((header) => {
      return [header.key, header.value];
    }),
  );
};

/**
 * Serves the app document with vercel.json's production headers and collects
 * CSP violations. Reloads the page so the document comes through this route.
 */
export const enforceProductionPolicy = async (page: Page) => {
  const headers = productionHeaders();
  if (!headers["Content-Security-Policy"])
    throw Error("vercel.json has no Content-Security-Policy for /.");
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __csp: string[] }).__csp = seen;
    document.addEventListener(
      "securitypolicyviolation",
      (event) => {
        seen.push(`${event.violatedDirective} ${event.blockedURI}`);
      },
      true,
    );
  });
  await page.route(
    (url) => {
      return url.origin === APP && url.pathname === "/";
    },
    (route) => {
      return route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        headers,
        body: readFileSync(resolve("out/index.html")),
      });
    },
  );
  const response = await page.reload();
  const served = await response?.headerValue("content-security-policy");
  if (served !== headers["Content-Security-Policy"])
    throw Error("The document did not come with the production CSP.");
  return {
    violations: () => {
      return page.evaluate(() => {
        return (window as unknown as { __csp: string[] }).__csp;
      });
    },
  };
};
