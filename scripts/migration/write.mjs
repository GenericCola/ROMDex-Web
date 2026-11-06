// The migration's write step (docs/YOUTRACK-STORAGE.md section 4, steps 6 to
// 10), through the store core the browser uses. Both stores are checked before
// anything is written, so a store holding other content stops the whole run
// with nothing created, uploaded or changed. Nothing here deletes anything.
import {
  articleManifest,
  commitStore,
  createArticle,
  findArticle,
  PERMITTED_USERS,
  readArticle,
  readStore,
  STORE_TARGETS,
} from "../../src/store/core/index.ts";
import {
  partsToMetadata,
  partsToNpcdex,
  readManifest,
} from "../../src/store/parts/index.ts";
import { metadataHash, sha256Hex } from "./romdex-data.mjs";

const TEST_PROJECT_ID = "0-4";
const TEST_LABEL = /^[a-z0-9-]{1,24}$/;

// Receipt labels for each store when the run stops: nothing was written to any.
const STOPPED_LABELS = {
  different: "different-content",
  migrated: "already-migrated",
  missing: "not-created",
  empty: "not-written",
};

/** The plan's key for each store. */
export const STORES = [
  { store: "romdex-metadata", plan: "metadata" },
  { store: "npcdex", plan: "npcdex" },
];

/**
 * Where each store goes. Test articles live in TST, are marked safe to delete,
 * and an optional label makes a separate pair (used to prove the stops).
 */
export const writeTargets = ({ target, label }) => {
  if (target === "production") {
    if (label) throw new Error("--test-label is only for --target test.");
    return STORE_TARGETS;
  }
  if (target !== "test") throw new Error(`Unknown target ${target}`);
  if (label !== undefined && !TEST_LABEL.test(label))
    throw new Error(
      "--test-label takes 1 to 24 lowercase letters, digits or -.",
    );
  const mark = `(migration test${label ? ` ${label}` : ""}, safe to delete)`;
  const testTarget = (store, name) => ({
    store,
    projectId: TEST_PROJECT_ID,
    title: `${name} ${mark}`,
    permittedUsers: PERMITTED_USERS,
  });
  return {
    "romdex-metadata": testTarget("romdex-metadata", "ROMDex data"),
    npcdex: testTarget("npcdex", "NPCDex data"),
  };
};

/** The plan's article lines for the report, from the write targets. */
export const reportArticles = (targets) => ({
  metadata: {
    project: targets["romdex-metadata"].projectId,
    projectId: targets["romdex-metadata"].projectId,
    title: targets["romdex-metadata"].title,
  },
  npcdex: {
    project: targets.npcdex.projectId,
    projectId: targets.npcdex.projectId,
    title: targets.npcdex.title,
  },
});

/** The hash a store's parts rebuild to, comparable with the plan's source hash. */
export const rebuiltHash = (store, parts) =>
  store === "npcdex"
    ? sha256Hex(Buffer.from(JSON.stringify(partsToNpcdex(parts).document)))
    : metadataHash(partsToMetadata(parts));

const sameKeys = (a, b) =>
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

const sameSourceData = (a, b) =>
  Boolean(a) && a.repo === b.repo && a.head === b.head && a.sha256 === b.sha256;

const ARTICLE_SEARCH_FIELDS = "id,idReadable,summary,content,project(id)";

// Articles with the store's exact title and project whose body is not a
// manifest for this store. findArticle skips them, so the migration would make
// a second article next to one somebody already uses; it stops instead.
const unusableTitleMatches = async (transport, target) => {
  const params = new URLSearchParams({
    query: `{${target.title}}`,
    fields: ARTICLE_SEARCH_FIELDS,
    $top: "100",
  });
  const found = await transport.request(`articles?${params.toString()}`);
  if (!Array.isArray(found))
    throw new Error("YouTrack returned an invalid list.");
  return found
    .filter(function sameTitle(article) {
      return (
        article?.summary === target.title &&
        article?.project?.id === target.projectId
      );
    })
    .filter(function unusable(article) {
      const kind = readManifest(article.content ?? "", target.store).kind;
      return kind !== "ok";
    })
    .map((article) => article.idReadable ?? article.id);
};

const describeArticle = (article) => ({
  id: article.id,
  idReadable: article.idReadable,
  title: article.summary,
  projectId: article.projectId,
});

/**
 * Looks at one store's article without writing: missing, created but empty,
 * already migrated from the same source, or holding something else.
 */
export const classifyStore = async ({ transport, target, storePlan }) => {
  const expected = storePlan.manifest.source;
  const unusable = await unusableTitleMatches(transport, target);
  if (unusable.length)
    return {
      kind: "different",
      reason: `An article titled "${target.title}" exists without a ROMDex manifest for ${target.store}: ${unusable.join(", ")}.`,
    };
  const found = await findArticle(transport, target);
  if (found.kind === "ambiguous")
    return {
      kind: "different",
      reason: `Several articles are titled "${target.title}": ${found.ids.join(", ")}. Pick one by hand; the migration does not choose.`,
    };
  if (found.kind === "missing") return { kind: "missing" };
  const { article } = found;
  let snapshot;
  try {
    snapshot = await readStore(transport, article, target.store);
  } catch (error) {
    return {
      kind: "different",
      article: describeArticle(article),
      reason: `${article.idReadable} cannot be read back: ${error.message}`,
    };
  }
  const { manifest } = snapshot;
  if (
    manifest.revision === 0 &&
    Object.keys(manifest.files).length === 0 &&
    !manifest.source
  )
    return { kind: "empty", article, snapshot };
  const rebuilt = rebuiltHash(target.store, snapshot.parts);
  const keys = Object.keys(manifest.files);
  const planKeys = storePlan.parts.map((part) => part.key);
  if (
    sameSourceData(manifest.source, expected) &&
    rebuilt === expected.sha256 &&
    sameKeys(keys, planKeys)
  )
    return {
      kind: "migrated",
      article,
      snapshot,
      rebuilt,
      sourceCommit: manifest.source.commit,
    };
  return {
    kind: "different",
    article: describeArticle(article),
    reason: `${article.idReadable} holds other content; the migration does not merge into a live store.`,
    difference: {
      revision: manifest.revision,
      writtenAt: manifest.writtenAt,
      writtenBy: manifest.writtenBy,
      source: manifest.source ?? null,
      expectedSource: expected,
      rebuiltSha256: rebuilt,
      expectedSha256: expected.sha256,
      parts: keys.length,
      expectedParts: planKeys.length,
      missingParts: planKeys.filter((key) => !keys.includes(key)),
      extraParts: keys.filter((key) => !planKeys.includes(key)),
    },
  };
};

const manifestFiles = (manifest) =>
  Object.entries(manifest.files).map(function file([key, entry]) {
    return {
      key,
      name: entry.name,
      id: entry.id,
      sha256: entry.sha256,
      size: entry.size,
    };
  });

/** Step 8: reads the article again and rebuilds the document from YouTrack alone. */
export const verifyStore = async ({
  transport,
  articleId,
  target,
  storePlan,
}) => {
  const expected = storePlan.manifest.source;
  const article = await readArticle(transport, articleId);
  if (!article) throw new Error(`${articleId} cannot be read back.`);
  const snapshot = await readStore(transport, article, target.store);
  const { manifest } = snapshot;
  if (!sameSourceData(manifest.source, expected))
    throw new Error(
      `${article.idReadable}: the manifest source does not match the plan.`,
    );
  const planKeys = storePlan.parts.map((part) => part.key);
  if (!sameKeys(Object.keys(manifest.files), planKeys))
    throw new Error(
      `${article.idReadable}: the stored parts differ from the plan.`,
    );
  const rebuilt = rebuiltHash(target.store, snapshot.parts);
  if (rebuilt !== expected.sha256)
    throw new Error(
      `${article.idReadable}: YouTrack's parts rebuild to ${rebuilt}, expected ${expected.sha256}.`,
    );
  return {
    article: describeArticle(article),
    manifest: {
      revision: manifest.revision,
      writeId: manifest.writeId,
      writtenAt: manifest.writtenAt,
      writtenBy: manifest.writtenBy,
      source: manifest.source,
    },
    files: manifestFiles(manifest),
    downloadedParts: snapshot.parts.length,
    rebuiltSha256: rebuilt,
  };
};

/**
 * Runs the write step. `transport` is a store transport, `github` the pinned
 * ROMDex-Data source the plan was built from. Answers a receipt; throws when a
 * write or the verification fails.
 */
export const runWrite = async ({
  plan,
  transport,
  github,
  targets,
  writtenBy,
  log = () => {},
}) => {
  for (const { plan: key } of STORES) {
    if (plan[key].oversized.length)
      throw new Error(
        `${plan[key].store} has parts over the 4,000,000-byte limit. Nothing was written.`,
      );
  }

  // Steps 6: look at both stores before writing anything.
  const checks = [];
  for (const { store, plan: key } of STORES) {
    const check = await classifyStore({
      transport,
      target: targets[store],
      storePlan: plan[key],
    });
    log(`${targets[store].title}: ${check.kind}`);
    checks.push({ store, key, check });
  }
  const receipt = {
    format: "romdex-migration-receipt",
    version: 1,
    target: plan.target,
    startedAt: plan.startedAt,
    source: {
      repo: plan.source.repo,
      branch: plan.source.branch,
      commit: plan.source.commit,
      tree: plan.source.tree,
    },
    writtenBy,
    stores: {},
  };
  const stopped = checks.filter(({ check }) => check.kind === "different");
  if (stopped.length) {
    for (const { store, check } of checks)
      receipt.stores[store] = {
        title: targets[store].title,
        result: STOPPED_LABELS[check.kind],
        ...(check.article
          ? {
              article: check.article.id
                ? { id: check.article.id, idReadable: check.article.idReadable }
                : check.article,
            }
          : {}),
        ...(check.reason ? { reason: check.reason } : {}),
        ...(check.difference ? { difference: check.difference } : {}),
      };
    return {
      ...receipt,
      result: "stopped",
      finishedAt: new Date().toISOString(),
    };
  }

  // Step 7: create what is missing, then upload and write each manifest.
  const written = {};
  for (const { store, key, check } of checks) {
    if (check.kind === "migrated") continue;
    const target = targets[store];
    const article =
      check.kind === "missing"
        ? await createArticle(transport, target, writtenBy)
        : check.article;
    if (check.kind === "missing")
      log(`Created ${article.idReadable} "${target.title}"`);
    const base =
      check.kind === "missing"
        ? {
            article,
            manifest: articleManifest(article, store),
            parts: [],
            unavailable: [],
          }
        : check.snapshot;
    const result = await commitStore(transport, {
      base,
      parts: plan[key].values,
      writtenBy,
      source: plan[key].manifest.source,
    });
    if (result.kind !== "written")
      throw new Error(
        `${article.idReadable}: the manifest write ended "${result.kind}". Run again to continue; uploads already made are reused.`,
      );
    log(
      `Wrote ${article.idReadable}: ${result.uploaded.length} uploaded, ${result.reused.length} reused, revision ${result.manifest.revision}`,
    );
    written[store] = {
      created: check.kind === "missing",
      article,
      uploaded: result.uploaded,
      reused: result.reused,
    };
  }

  // Step 8: verify every store from YouTrack alone.
  for (const { store, key, check } of checks) {
    const articleId = (written[store]?.article ?? check.article).id;
    const verified = await verifyStore({
      transport,
      articleId,
      target: targets[store],
      storePlan: plan[key],
    });
    receipt.stores[store] = {
      title: targets[store].title,
      result: written[store] ? "written" : "already-migrated",
      created: written[store]?.created ?? false,
      uploaded: written[store]?.uploaded ?? [],
      reused: written[store]?.reused ?? [],
      ...(check.kind === "migrated" && check.sourceCommit !== plan.source.commit
        ? { migratedFromCommit: check.sourceCommit }
        : {}),
      expectedSha256: plan[key].manifest.source.sha256,
      ...verified,
    };
    log(
      `Verified ${verified.article.idReadable} from YouTrack: ${verified.rebuiltSha256}`,
    );
  }

  // Step 9: ROMDex-Data must not have moved while we wrote.
  await github.assertUnmoved();
  receipt.source.headUnchanged = true;
  const anyWritten = Object.keys(written).length > 0;
  return {
    ...receipt,
    result: anyWritten ? "written" : "already-migrated",
    finishedAt: new Date().toISOString(),
  };
};
