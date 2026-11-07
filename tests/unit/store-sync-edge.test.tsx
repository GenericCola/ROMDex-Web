import assert from "node:assert/strict";
import { test } from "node:test";
import { imageUrl } from "../../src/storage/image-storage";
import type { StoreState } from "../../src/store/browser/cache";
import { npcdexBinding } from "../../src/store/browser/npcdex-binding";
import { romdexBinding } from "../../src/store/browser/romdex-binding";
import { offlineMessage, outcomeStatus } from "../../src/store/browser/status";
import { syncStore } from "../../src/store/browser/sync";
import { tooLargeMessage } from "../../src/store/parts/limits";
import { PNG, randomBytes } from "../fixtures/store-core-setup";
import {
  SCOPE,
  device,
  twoArticles,
  withIdb,
} from "../fixtures/store-sync-setup";

const dataUrl = (bytes: Uint8Array) => {
  return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
};

const NPC = "npcdex" as const;

test("delivery running waits and makes no YouTrack call", () => {
  return withIdb(async () => {
    const { fake } = await twoArticles();
    const a = device("a");
    a.snapshot.delivering = true;
    const outcome = await syncStore(a.deps(fake), romdexBinding);
    assert.equal(outcome.kind, "waiting");
    assert.equal(fake.calls.length, 0);
    a.snapshot.delivering = false;
    a.snapshot.data.remote = [];
    const empty = await syncStore(a.deps(fake), romdexBinding);
    assert.deepEqual(empty, {
      kind: "waiting",
      reason: "Read YouTrack tasks first.",
    });
    assert.equal(fake.calls.length, 0);
  });
});

test("offline sync throws, writes nothing and the next sync uploads", () => {
  return withIdb(async () => {
    const { fake } = await twoArticles();
    const a = device("a");
    await syncStore(a.deps(fake), romdexBinding);
    const before = await a.cache.getState(SCOPE, "romdex-metadata");
    a.snapshot.data.images = { "PMON-2": PNG };
    const request = fake.request;
    fake.request = () => {
      return Promise.reject(new TypeError("Failed to fetch"));
    };
    await assert.rejects(syncStore(a.deps(fake), romdexBinding), /fetch/);
    assert.deepEqual(await a.cache.getState(SCOPE, "romdex-metadata"), before);
    assert.equal(imageUrl(a.snapshot.data.images?.["PMON-2"]), PNG);
    fake.request = request;
    const calls = fake.calls.length;
    const outcome = await syncStore(a.deps(fake), romdexBinding);
    assert.equal(outcome.kind === "synced" && outcome.written, true);
    assert.ok(fake.calls.length > calls);
    const b = device("b");
    await syncStore(b.deps(fake), romdexBinding);
    assert.equal(imageUrl(b.snapshot.data.images?.["PMON-2"]), PNG);
  });
});

test("a key edited while the sync runs keeps the local edit", () => {
  return withIdb(async () => {
    const { fake } = await twoArticles();
    const a = device("a");
    const b = device("b");
    await syncStore(a.deps(fake), romdexBinding);
    await syncStore(b.deps(fake), romdexBinding);
    a.snapshot.data.images = { "PMON-2": PNG };
    await syncStore(a.deps(fake), romdexBinding);
    // B has an unrelated change, so it writes; during that write B edits
    // the key YouTrack is about to give it.
    const NEWER = "data:image/png;base64,AAAA";
    b.snapshot.data.images = { "PMON-4": PNG };
    let edited = false;
    fake.onBeforeContentWrite = () => {
      edited = true;
      b.snapshot.data.images = { ...b.snapshot.data.images, "PMON-2": NEWER };
    };
    const outcome = await syncStore(b.deps(fake), romdexBinding);
    fake.onBeforeContentWrite = undefined;
    assert.equal(edited, true);
    assert.equal(outcome.kind, "synced");
    assert.equal(imageUrl(b.snapshot.data.images?.["PMON-2"]), NEWER);
    // The edit was not recorded as synced: the next sync sees it as a change.
    if (outcome.kind !== "synced") return;
    assert.equal(
      Object.hasOwn(outcome.state.base?.values ?? {}, "image/PMON-2"),
      false,
    );
    assert.equal(outcome.state.base?.values["image/PMON-4"], PNG);
    const next = await syncStore(b.deps(fake), romdexBinding);
    assert.equal(next.kind === "synced" && next.state.review[0]?.local, NEWER);
    assert.equal(imageUrl(b.snapshot.data.images?.["PMON-2"]), PNG);
  });
});

test("assigned state of a parent reaches the other device", () => {
  return withIdb(async () => {
    const { fake } = await twoArticles();
    const a = device("a");
    const b = device("b");
    await syncStore(a.deps(fake), romdexBinding);
    await syncStore(b.deps(fake), romdexBinding);
    a.snapshot.data.remote = a.snapshot.data.remote.map((entry) => {
      return entry.id === "PMON-1"
        ? { ...entry, assignedState: "In Progress" }
        : entry;
    });
    await syncStore(a.deps(fake), romdexBinding);
    await syncStore(b.deps(fake), romdexBinding);
    const parent = b.snapshot.data.remote.find((entry) => {
      return entry.id === "PMON-1";
    });
    assert.equal(parent?.assignedState, "In Progress");
    assert.equal(
      b.snapshot.data.cloud?.assigned?.["PMON-1"]?.assignedState,
      "In Progress",
    );
  });
});

const townsDocument = () => {
  return {
    schema: 1,
    towns: [
      { id: "t1", name: "One" },
      { id: "t2", name: "Two" },
    ],
  };
};

test("NPCDex document reaches a device that has none", () => {
  return withIdb(async () => {
    const { fake } = await twoArticles();
    const a = device("a");
    a.snapshot.data.npcdex = townsDocument();
    a.snapshot.data.npcdexDrafts = { k: { v: 1 } } as never;
    const first = await syncStore(a.deps(fake, NPC), npcdexBinding);
    assert.equal(first.kind === "synced" && first.written, true);
    const b = device("b");
    await syncStore(b.deps(fake, NPC), npcdexBinding);
    assert.deepEqual(b.snapshot.data.npcdex, townsDocument());
    assert.deepEqual(b.snapshot.data.npcdexDrafts, { k: { v: 1 } });
  });
});

test("a device with no NPCDex document never removes towns", () => {
  return withIdb(async () => {
    const { fake } = await twoArticles();
    const a = device("a");
    a.snapshot.data.npcdex = townsDocument();
    await syncStore(a.deps(fake, NPC), npcdexBinding);
    const c = device("c");
    const first = await syncStore(c.deps(fake, NPC), npcdexBinding);
    assert.equal(first.kind === "synced" && first.written, false);
    // After a base exists, a later sync still writes nothing.
    const second = await syncStore(c.deps(fake, NPC), npcdexBinding);
    assert.equal(second.kind === "synced" && second.written, false);
    const again = await syncStore(a.deps(fake, NPC), npcdexBinding);
    assert.equal(again.kind === "synced" && again.written, false);
    assert.equal((a.snapshot.data.npcdex?.["towns"] as unknown[]).length, 2);
  });
});

const bigTown = (id: string) => {
  return { id, name: id, image: dataUrl(randomBytes(4_600_000)) };
};

test("a changed town over 4 MB is refused, the rest syncs and it stays pending", () => {
  return withIdb(async () => {
    const { fake } = await twoArticles();
    const a = device("a");
    a.snapshot.data.npcdex = townsDocument();
    await syncStore(a.deps(fake, NPC), npcdexBinding);
    const big = bigTown("t2");
    a.snapshot.data.npcdex = {
      schema: 1,
      towns: [{ id: "t1", name: "Renamed" }, big],
    };
    const outcome = await syncStore(a.deps(fake, NPC), npcdexBinding);
    assert.equal(outcome.kind, "synced");
    if (outcome.kind !== "synced") return;
    const [refused] = outcome.state.refused;
    assert.equal(outcome.state.refused.length, 1);
    assert.ok(refused && refused.size > 4_000_000);
    assert.equal(refused.message, tooLargeMessage(refused.name, refused.size));
    assert.equal(outcome.state.pending, true);
    assert.equal(outcome.written, true);
    const status = outcomeStatus(NPC, outcome, outcome.state);
    assert.equal(status.kind, "synced");
    assert.equal(status.message, offlineMessage);
    assert.equal(status.refused.length, 1);
    const towns = () => {
      return a.snapshot.data.npcdex?.["towns"] as { image?: string }[];
    };
    assert.equal(towns()[1]?.image, big.image);
    // The other key reached YouTrack: a fresh reader sees it through its cache.
    const again = await syncStore(a.deps(fake, NPC), npcdexBinding);
    assert.equal(again.kind === "synced" && again.state.refused.length, 1);
    assert.equal(again.kind === "synced" && again.state.pending, true);
    assert.equal(again.kind === "synced" && again.written, false);
    assert.equal(towns()[1]?.image, big.image);
    assert.equal(
      (towns()[0] as { name?: string } | undefined)?.name,
      "Renamed",
    );
  });
});

test("a brand-new town over 4 MB must not make the article unreadable", () => {
  return withIdb(async () => {
    const { fake } = await twoArticles();
    const a = device("a");
    a.snapshot.data.npcdex = townsDocument();
    await syncStore(a.deps(fake, NPC), npcdexBinding);
    a.snapshot.data.npcdex = {
      schema: 1,
      towns: [...townsDocument().towns, bigTown("t3")],
    };
    const outcome = await syncStore(a.deps(fake, NPC), npcdexBinding);
    assert.equal(outcome.kind, "synced");
    const again = await syncStore(a.deps(fake, NPC), npcdexBinding);
    assert.equal(again.kind, "synced");
  });
});

test("outcomeStatus words every outcome", () => {
  const state: StoreState = { pending: false, refused: [], review: [] };
  const synced = { kind: "synced", state, written: false } as const;
  assert.equal(
    outcomeStatus("romdex-metadata", synced, state).message,
    "Synced with YouTrack.",
  );
  const review = {
    ...state,
    review: [{ key: "k", remoteWrittenAt: "", remoteWrittenBy: "", at: "" }],
  };
  const reviewed = outcomeStatus("npcdex", synced, review);
  assert.equal(reviewed.message, "Needs review: 1 changed on two devices.");
  assert.equal(reviewed.review.length, 1);
  assert.equal(
    outcomeStatus("npcdex", { kind: "not-set-up" }, state).message,
    'Not set up: YouTrack has no "NPCDex data" article. Your data stays in this browser.',
  );
  const ambiguous = outcomeStatus(
    "romdex-metadata",
    { kind: "ambiguous", ids: ["A-1", "A-2"] },
    state,
  );
  assert.equal(ambiguous.kind, "ambiguous");
  assert.deepEqual(ambiguous.ids, ["A-1", "A-2"]);
  assert.match(
    ambiguous.message,
    /\(A-1, A-2\)\. Choose one before syncing\.$/,
  );
  assert.equal(
    outcomeStatus("npcdex", { kind: "waiting", reason: "why" }, state).message,
    "why",
  );
  const busy = outcomeStatus("npcdex", { kind: "busy" }, state);
  assert.equal(busy.kind, "busy");
  assert.equal(busy.message, "Another device is saving. Try again.");
});
