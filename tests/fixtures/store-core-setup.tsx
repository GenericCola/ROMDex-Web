import type { StoreArticle } from "../../src/store/core/article.ts";
import { createArticle } from "../../src/store/core/article.ts";
import type { StoreSnapshot } from "../../src/store/core/read.ts";
import { articleManifest } from "../../src/store/core/read.ts";
import { STORE_TARGETS } from "../../src/store/core/transport.ts";
import type { PartValue } from "../../src/store/parts/files.ts";
import type {
  StoreManifest,
  StoreName,
} from "../../src/store/parts/manifest.ts";
import { manifestContent } from "../../src/store/parts/manifest.ts";
import { FakeYouTrackStore } from "./fake-youtrack-store.tsx";

export const ROMDEX = STORE_TARGETS["romdex-metadata"];
export const PNG = "data:image/png;base64,iVBORw0KGgoAAQI=";
export const GIF = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

/** A fake YouTrack holding a fresh, empty ROMDex data article. */
export const freshStore = async (store: StoreName = "romdex-metadata") => {
  const fake = new FakeYouTrackStore();
  const article = await createArticle(fake, STORE_TARGETS[store], "2-1");
  fake.calls.length = 0;
  return { fake, article, base: baseOf(article, store) };
};

export const baseOf = (
  article: StoreArticle,
  store: StoreName = "romdex-metadata",
): StoreSnapshot => {
  return {
    article,
    manifest: articleManifest(article, store),
    parts: [],
    unavailable: [],
  };
};

/** The manifest of `base` as another device would have written it next. */
export const otherDevice = (manifest: StoreManifest) => {
  return manifestContent({
    ...manifest,
    revision: manifest.revision + 1,
    writeId: "another-device",
  });
};

export const json = (key: string, value: unknown): PartValue => {
  return { key, codec: "gzip-json", value };
};

export const randomBytes = (size: number) => {
  const bytes = new Uint8Array(size);
  for (let at = 0; at < size; at += 65536)
    crypto.getRandomValues(bytes.subarray(at, Math.min(size, at + 65536)));
  return bytes;
};
