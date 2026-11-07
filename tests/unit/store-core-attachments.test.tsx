import assert from "node:assert/strict";
import { test } from "node:test";
import {
  listAttachments,
  readAttachment,
} from "../../src/store/core/attachments.ts";
import { commitStore } from "../../src/store/core/write.ts";
import { freshStore, json } from "../fixtures/store-core-setup.tsx";

test("listAttachments reads every page and skips removed files", async () => {
  const { fake, article } = await freshStore();
  const stored = fake.articles.get(article.id);
  assert.ok(stored);
  for (let at = 0; at < 250; at++)
    stored.attachments.push({
      id: `1-${at}`,
      name: `f${at}.bin`,
      bytes: new Uint8Array(at % 7),
    });
  const files = await listAttachments(fake, article.id);
  assert.equal(files.length, 250);
  assert.equal(fake.count("GET", /attachments$/), 3);
  assert.equal(await readAttachment(fake, article.id, "9-9"), null);
});

test("a failed upload leaves the manifest untouched and never writes content", async () => {
  const { fake, article, base } = await freshStore();
  fake.failNextUpload = true;
  await assert.rejects(
    commitStore(fake, { base, parts: [json("orders", {})], writtenBy: "2-1" }),
    /500/,
  );
  assert.equal(fake.articles.get(article.id)?.content, article.content);
  assert.equal(fake.count("POST", new RegExp(`^articles/${article.id}$`)), 0);
});

test("the fake refuses DELETE", async () => {
  const { fake } = await freshStore();
  await assert.rejects(fake.request("articles/181-1", "DELETE"), /DELETE/);
});
