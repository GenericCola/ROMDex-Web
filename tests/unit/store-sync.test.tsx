import assert from "node:assert/strict";
import { test } from "node:test";
import { settleReview } from "../../src/store/browser/review";
import { romdexBinding } from "../../src/store/browser/romdex-binding";
import { syncStore } from "../../src/store/browser/sync";
import { createArticle } from "../../src/store/core/article";
import { STORE_TARGETS } from "../../src/store/core/transport";
import { readManifest } from "../../src/store/parts/manifest";
import { FakeYouTrackStore } from "../fixtures/fake-youtrack-store";
import { GIF, PNG } from "../fixtures/store-core-setup";
import {
  SCOPE,
  device,
  twoArticles,
  withIdb,
} from "../fixtures/store-sync-setup";

const synced = async (
  d: ReturnType<typeof device>,
  fake: FakeYouTrackStore,
) => {
  const outcome = await syncStore(d.deps(fake), romdexBinding);
  assert.equal(outcome.kind, "synced");
  return outcome.kind === "synced" ? outcome : assert.fail("not synced");
};

const revisionOf = (fake: FakeYouTrackStore) => {
  const [article] = [...fake.articles.values()];
  if (!article) return assert.fail("no article");
  const read = readManifest(article.content, "romdex-metadata");
  return read.kind === "ok" ? read.manifest.revision : assert.fail("manifest");
};

test("no article is not-set-up and two matching articles are ambiguous", () => {
  return withIdb(async () => {
    const fake = new FakeYouTrackStore();
    const a = device("a");
    assert.deepEqual(await syncStore(a.deps(fake), romdexBinding), {
      kind: "not-set-up",
    });
    const target = STORE_TARGETS["romdex-metadata"];
    await createArticle(fake, target, "2-1");
    await createArticle(fake, target, "2-1");
    const outcome = await syncStore(a.deps(fake), romdexBinding);
    assert.equal(outcome.kind, "ambiguous");
  });
});

test("first sync uploads; a fresh device keeps its own keys and takes YouTrack's", () => {
  return withIdb(async () => {
    const { fake } = await twoArticles();
    const a = device("a");
    a.snapshot.data.images = { "PMON-2": PNG };
    a.snapshot.data.order = { "PMON-4": 0, "PMON-3": 1, "PMON-2": 2 };
    const first = await synced(a, fake);
    assert.equal(first.written, true);
    assert.equal(first.state.base?.revision, 1);
    assert.equal(revisionOf(fake), 1);

    const b = device("b");
    b.snapshot.data.images = { "PMON-3": GIF };
    b.snapshot.data.order = { "PMON-2": 0, "PMON-3": 1, "PMON-4": 2 };
    const second = await synced(b, fake);
    assert.equal(second.state.review.length, 0);
    assert.equal(second.written, true);
    // B took YouTrack's value for the keys YouTrack has.
    assert.equal(b.snapshot.data.images?.["PMON-2"], PNG);
    assert.ok(
      (b.snapshot.data.order["PMON-4"] ?? 9) <
        (b.snapshot.data.order["PMON-2"] ?? 0),
    );
    // B kept and uploaded its own key.
    assert.equal(b.snapshot.data.images?.["PMON-3"], GIF);
    await synced(a, fake);
    assert.equal(a.snapshot.data.images?.["PMON-3"], GIF);
  });
});

test("edits to different keys on both devices merge and converge", () => {
  return withIdb(async () => {
    const { fake } = await twoArticles();
    const a = device("a");
    const b = device("b");
    await synced(a, fake);
    await synced(b, fake);
    a.snapshot.data.images = { "PMON-2": PNG };
    b.snapshot.data.images = { "PMON-3": GIF };
    await synced(a, fake);
    await synced(b, fake);
    await synced(a, fake);
    for (const d of [a, b])
      assert.deepEqual(d.snapshot.data.images, {
        "PMON-2": PNG,
        "PMON-3": GIF,
      });
  });
});

test("same-key change is a conflict reviewed and settled", () => {
  return withIdb(async () => {
    const { fake } = await twoArticles();
    const a = device("a");
    const b = device("b");
    await synced(a, fake);
    await synced(b, fake);
    a.snapshot.data.images = { "PMON-2": PNG };
    b.snapshot.data.images = { "PMON-2": GIF };
    await synced(a, fake);
    const result = await synced(b, fake);
    assert.equal(result.written, false);
    const [review] = result.state.review;
    assert.equal(review?.key, "image/PMON-2");
    assert.equal(review?.local, GIF);
    assert.equal(review?.remote, PNG);
    assert.equal(b.snapshot.data.images?.["PMON-2"], PNG);
    const recovery = await b.cache.listRecovery(SCOPE);
    assert.deepEqual(
      recovery.map((entry) => {
        return [entry.key, entry.reason, entry.local];
      }),
      [["image/PMON-2", "conflict", GIF]],
    );
    // YouTrack keeps the first value for another device.
    const c = device("c");
    await synced(c, fake);
    assert.equal(c.snapshot.data.images?.["PMON-2"], PNG);

    await settleReview(b.deps(fake), romdexBinding, "image/PMON-2", "mine");
    assert.equal(b.snapshot.data.images?.["PMON-2"], GIF);
    const after = await synced(b, fake);
    assert.equal(after.state.review.length, 0);
    assert.equal(after.written, true);
    await synced(a, fake);
    assert.equal(a.snapshot.data.images?.["PMON-2"], GIF);
    assert.equal((await b.cache.listRecovery(SCOPE)).length, 2);
  });
});

test("keeping YouTrack's value clears the review and keeps recovery", () => {
  return withIdb(async () => {
    const { fake } = await twoArticles();
    const a = device("a");
    const b = device("b");
    await synced(a, fake);
    await synced(b, fake);
    a.snapshot.data.order = { "PMON-4": 0, "PMON-3": 1, "PMON-2": 2 };
    b.snapshot.data.order = { "PMON-3": 0, "PMON-2": 1, "PMON-4": 2 };
    await synced(a, fake);
    const result = await synced(b, fake);
    assert.equal(result.state.review[0]?.key, "orders/PMON-1");
    await settleReview(
      b.deps(fake),
      romdexBinding,
      "orders/PMON-1",
      "youtrack",
    );
    const state = await b.cache.getState(SCOPE, "romdex-metadata");
    assert.equal(state.review.length, 0);
    const reasons = (await b.cache.listRecovery(SCOPE)).map((entry) => {
      return entry.reason;
    });
    assert.deepEqual(reasons, ["conflict", "kept-youtrack"]);
    await synced(b, fake);
    assert.equal(revisionOf(fake), 2);
  });
});

/** Another device rewrites the manifest just before our commit's check, `times` times. */
const moveDuringCommit = (fake: FakeYouTrackStore, times: number) => {
  const [article] = [...fake.articles.values()];
  if (!article) return assert.fail("no article");
  const request = fake.request;
  let moves = 0;
  let afterFiles = false;
  fake.request = async (route, method, body, missing) => {
    const isArticle = /^articles\/181-1(\?|$)/.test(route);
    if (isArticle && (method ?? "GET") === "GET" && afterFiles) {
      afterFiles = false;
      const read = readManifest(article.content, "romdex-metadata");
      if (moves < times && read.kind === "ok") {
        article.content = article.content.replace(
          read.manifest.writeId,
          `other-${moves}`,
        );
        moves += 1;
      }
    }
    if (/\/attachments/.test(route)) afterFiles = true;
    return request(route, method, body, missing);
  };
  return () => {
    return moves;
  };
};

test("a moved manifest is retried and then succeeds", () => {
  return withIdb(async () => {
    const { fake } = await twoArticles();
    const b = device("b");
    await synced(b, fake);
    b.snapshot.data.images = { "PMON-2": PNG };
    const moves = moveDuringCommit(fake, 1);
    const outcome = await syncStore(b.deps(fake), romdexBinding);
    assert.equal(outcome.kind, "synced");
    assert.equal(moves(), 1);
    assert.equal(outcome.kind === "synced" && outcome.written, true);
  });
});

test("three consecutive moves are busy and lose nothing", () => {
  return withIdb(async () => {
    const { fake } = await twoArticles();
    const b = device("b");
    await synced(b, fake);
    const before = await b.cache.getState(SCOPE, "romdex-metadata");
    b.snapshot.data.images = { "PMON-2": PNG };
    const moves = moveDuringCommit(fake, 3);
    const outcome = await syncStore(b.deps(fake), romdexBinding);
    assert.equal(outcome.kind, "busy");
    assert.equal(moves(), 3);
    assert.deepEqual(await b.cache.getState(SCOPE, "romdex-metadata"), before);
    assert.equal(b.snapshot.data.images?.["PMON-2"], PNG);
  });
});
