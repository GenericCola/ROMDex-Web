import assert from "node:assert/strict";
import { test } from "node:test";
import { createArticle, findArticle } from "../../src/store/core/article.ts";
import { STORE_TARGETS } from "../../src/store/core/transport.ts";
import {
  emptyManifest,
  manifestContent,
  readManifest,
} from "../../src/store/parts/manifest.ts";
import { FakeYouTrackStore } from "../fixtures/fake-youtrack-store.tsx";
import { ROMDEX } from "../fixtures/store-core-setup.tsx";

const NPC = STORE_TARGETS.npcdex;

const note = (store: "romdex-metadata" | "npcdex", version = 1) => {
  return manifestContent({
    ...emptyManifest(store, "2-1", "w", "2026-01-01T00:00:00.000Z"),
    version,
  } as never);
};

const seeded = () => {
  const fake = new FakeYouTrackStore();
  const good = fake.addArticle(
    "ROMDex data",
    note("romdex-metadata"),
    ROMDEX.projectId,
  );
  return { fake, good };
};

test("a cached id that matches is used without searching", async () => {
  const { fake, good } = seeded();
  const result = await findArticle(fake, ROMDEX, good.id);
  assert.equal(result.kind, "found");
  assert.deepEqual(
    fake.calls.map((call) => call.path),
    [`articles/${good.id}`],
  );
});

test("a cached id with the wrong title or project falls back to search", async () => {
  const { fake, good } = seeded();
  const title = fake.addArticle("Other", note("romdex-metadata"), "0-1");
  const project = fake.addArticle(
    "ROMDex data",
    note("romdex-metadata"),
    "0-9",
  );
  for (const bad of [title, project]) {
    fake.calls.length = 0;
    const result = await findArticle(fake, ROMDEX, bad.id);
    assert.ok(result.kind === "found" && result.article.id === good.id);
    assert.equal(fake.calls.length, 2);
  }
});

test("search finds one exact match, none, or two", async () => {
  const { fake, good } = seeded();
  const found = await findArticle(fake, ROMDEX);
  assert.ok(found.kind === "found" && found.article.id === good.id);
  assert.deepEqual(await findArticle(fake, NPC), { kind: "missing" });
  const twin = fake.addArticle(
    "ROMDex data",
    note("romdex-metadata"),
    ROMDEX.projectId,
  );
  assert.deepEqual(await findArticle(fake, ROMDEX), {
    kind: "ambiguous",
    ids: [good.idReadable, twin.idReadable],
  });
});

test("a manifest for the other store is ignored; a newer one is found", async () => {
  const fake = new FakeYouTrackStore();
  fake.addArticle("ROMDex data", note("npcdex"), ROMDEX.projectId);
  assert.deepEqual(await findArticle(fake, ROMDEX), { kind: "missing" });
  const newer = fake.addArticle(
    "ROMDex data",
    note("romdex-metadata", 2),
    ROMDEX.projectId,
  );
  const result = await findArticle(fake, ROMDEX);
  assert.ok(result.kind === "found" && result.article.id === newer.id);
});

test("createArticle posts project, title, visibility and an empty manifest", async () => {
  const fake = new FakeYouTrackStore();
  const article = await createArticle(fake, ROMDEX, "2-1");
  const stored = fake.articles.get(article.id);
  assert.equal(stored?.summary, "ROMDex data");
  assert.equal(stored?.projectId, "0-1");
  assert.deepEqual(stored?.visibility, {
    $type: "LimitedVisibility",
    permittedUsers: [{ id: "2-1" }, { id: "2-2" }],
  });
  const read = readManifest(article.content, "romdex-metadata");
  assert.ok(read.kind === "ok");
  assert.equal(read.manifest.revision, 0);
  assert.equal(read.manifest.writtenBy, "2-1");
  assert.deepEqual(read.manifest.files, {});
});
