import assert from "node:assert/strict";
import { test } from "node:test";
import { readArticle } from "../../src/store/core/article.ts";
import type { StoreSnapshot } from "../../src/store/core/read.ts";
import { readStore } from "../../src/store/core/read.ts";
import { commitStore } from "../../src/store/core/write.ts";
import type { PartValue } from "../../src/store/parts/files.ts";
import { samePartValue } from "../../src/store/parts/files.ts";
import { npcdexToParts } from "../../src/store/parts/npcdex-parts.ts";
import { metadataToParts } from "../../src/store/parts/romdex-parts.ts";
import {
  baseOf,
  freshStore,
  GIF,
  json,
  PNG,
} from "../fixtures/store-core-setup.tsx";

const metadata = () => ({
  version: 1,
  images: { "PMON-1": PNG, "PMON-2": GIF },
  orders: { ROOT: ["PMON-2", "PMON-1"] },
  assigned: { "PMON-3": "In Development" },
});

const reload = async (
  fake: Awaited<ReturnType<typeof freshStore>>["fake"],
  id: string,
): Promise<StoreSnapshot> => {
  const article = await readArticle(fake, id);
  assert.ok(article);
  return readStore(fake, article, "romdex-metadata");
};

const sameParts = (a: PartValue[], b: PartValue[]) => {
  assert.equal(a.length, b.length);
  for (const part of a) {
    const other = b.find((candidate) => candidate.key === part.key);
    assert.ok(other && samePartValue(part, other), part.key);
  }
};

test("ROMDex parts round trip, then stay unchanged", async () => {
  const { fake, article, base } = await freshStore();
  const parts = metadataToParts(metadata());
  const result = await commitStore(fake, { base, parts, writtenBy: "2-1" });
  assert.ok(result.kind === "written");
  assert.equal(result.manifest.revision, 1);
  assert.equal(result.uploaded.length, 4);
  const back = await reload(fake, article.id);
  sameParts(back.parts, parts);
  assert.equal(back.manifest.revision, 1);
  fake.calls.length = 0;
  const again = await commitStore(fake, {
    base: back,
    parts,
    writtenBy: "2-1",
  });
  assert.equal(again.kind, "unchanged");
  assert.equal(fake.count("POST", /./), 0);
  assert.equal(fake.count("GET", /attachments$/), 0);
});

test("NPCDex parts with images round trip", async () => {
  const { fake, article, base } = await freshStore("npcdex");
  const doc = {
    version: 2,
    towns: [{ id: "a", name: "A", img: PNG, other: [GIF] }],
    history: [{ id: "h1", timestamp: 1, pic: PNG }],
  };
  const parts = await npcdexToParts(doc);
  assert.ok(parts.some((part) => part.codec === "raw"));
  const result = await commitStore(fake, { base, parts, writtenBy: "2-1" });
  assert.ok(result.kind === "written");
  const stored = await readArticle(fake, article.id);
  assert.ok(stored);
  sameParts((await readStore(fake, stored, "npcdex")).parts, parts);
});

test("a changed part uploads one file, a removed part leaves the manifest, nothing is deleted", async () => {
  const { fake, article, base } = await freshStore();
  const parts = metadataToParts(metadata());
  await commitStore(fake, { base, parts, writtenBy: "2-1" });
  const one = await reload(fake, article.id);
  const changed = parts.map((part) => {
    return part.key === "assigned"
      ? json("assigned", { "PMON-3": "Done" })
      : part;
  });
  fake.calls.length = 0;
  const result = await commitStore(fake, {
    base: one,
    parts: changed,
    writtenBy: "2-1",
  });
  assert.ok(result.kind === "written");
  assert.deepEqual(result.uploaded, ["assigned"]);
  assert.equal(fake.count("POST", /attachments$/), 1);
  const two = await reload(fake, article.id);
  const fewer = changed.filter((part) => part.key !== "image/PMON-2");
  const removed = await commitStore(fake, {
    base: two,
    parts: fewer,
    writtenBy: "2-1",
  });
  assert.ok(removed.kind === "written");
  assert.equal(removed.uploaded.length, 0);
  assert.equal("image/PMON-2" in removed.manifest.files, false);
  assert.equal(fake.articles.get(article.id)?.attachments.length, 5);
  assert.equal(fake.count("DELETE", /./), 0);
});

test("an identical attachment already on the article is reused after a byte check", async () => {
  const { fake, article, base } = await freshStore();
  const parts = metadataToParts(metadata());
  await commitStore(fake, { base, parts, writtenBy: "2-1" });
  // Same parts against an empty base: a lost-manifest retry.
  fake.calls.length = 0;
  const fresh = baseOf((await readArticle(fake, article.id)) ?? article);
  const result = await commitStore(fake, {
    base: { ...fresh, manifest: { ...fresh.manifest, files: {} } },
    parts,
    writtenBy: "2-1",
  });
  assert.ok(result.kind === "written");
  assert.equal(result.reused.length, 4);
  assert.equal(result.uploaded.length, 0);
  assert.equal(fake.count("POST", /attachments$/), 0);
  assert.equal(fake.downloads.length, 4);
});

test("an attachment with the same name but other bytes is replaced by a fresh upload", async () => {
  const { fake, article, base } = await freshStore();
  const parts = [json("assigned", { a: 1 })];
  await commitStore(fake, { base, parts, writtenBy: "2-1" });
  const stored = fake.articles.get(article.id)?.attachments[0];
  assert.ok(stored);
  fake.corrupt(article.id, stored.id);
  const empty = baseOf((await readArticle(fake, article.id)) ?? article);
  const result = await commitStore(fake, {
    base: { ...empty, manifest: { ...empty.manifest, files: {} } },
    parts,
    writtenBy: "2-1",
  });
  assert.ok(result.kind === "written");
  assert.deepEqual(result.uploaded, ["assigned"]);
  assert.equal(fake.articles.get(article.id)?.attachments.length, 2);
});
