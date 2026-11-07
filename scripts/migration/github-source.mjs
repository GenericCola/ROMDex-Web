import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const RETRY_DELAYS_MS = [500, 1500];
const REQUEST_TIMEOUT_MS = 60_000;

const sleepTimer = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readJson = (response) => response.json();
const readBytes = async (response) => Buffer.from(await response.arrayBuffer());

const gitBlobSha = (bytes) =>
  createHash("sha1")
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest("hex");

export const createGitHubSource = ({
  repo,
  branch = "main",
  token,
  fetch = globalThis.fetch,
  cacheDir,
  concurrency = 8,
  apiBase = "https://api.github.com",
  sleep = sleepTimer,
}) => {
  const stats = { requests: 0, cacheHits: 0, downloads: 0, downloadedBytes: 0 };
  let pinned = null;

  const headersFor = (accept) => {
    const headers = {
      Accept: accept,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "romdex-migration",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  };

  const rateLimitError = (response) => {
    const reset = Number(response.headers.get("x-ratelimit-reset"));
    const when = reset
      ? new Date(reset * 1000).toISOString()
      : "an unknown time";
    return new Error(`GitHub rate limit reached, resets at ${when}`);
  };

  // Reads the body inside the retry loop: a stream cut off mid-body is retried
  // like any other network error.
  const get = async (apiPath, accept, read) => {
    const url = `${apiBase}${apiPath}`;
    const attempts = RETRY_DELAYS_MS.length + 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const isLast = attempt === attempts - 1;
      let response;
      stats.requests += 1;
      try {
        response = await fetch(url, {
          method: "GET",
          headers: headersFor(accept),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (response.ok) return await read(response);
      } catch {
        if (isLast)
          throw new Error(`GitHub GET ${apiPath} failed: network error`);
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      const limited =
        (response.status === 403 || response.status === 429) &&
        response.headers.get("x-ratelimit-remaining") === "0";
      if (limited) throw rateLimitError(response);
      if (response.status >= 500 && !isLast) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new Error(`GitHub GET ${apiPath} failed: ${response.status}`);
    }
    throw new Error(`GitHub GET ${apiPath} failed`);
  };

  const getJson = async (apiPath) =>
    get(apiPath, "application/vnd.github+json", readJson);

  const headNow = async () => {
    const data = await getJson(`/repos/${repo}/branches/${branch}`);
    return data.commit.sha;
  };

  const pin = async () => {
    const commit = await headNow();
    const commitData = await getJson(`/repos/${repo}/git/commits/${commit}`);
    const tree = commitData.tree.sha;
    const committedAt = commitData.committer.date;
    const treeData = await getJson(
      `/repos/${repo}/git/trees/${tree}?recursive=1`,
    );
    if (treeData.truncated) {
      throw new Error(`GitHub tree ${tree} of ${repo} was truncated`);
    }
    const files = new Map();
    for (const entry of treeData.tree) {
      if (entry.type === "blob") {
        files.set(entry.path, { sha: entry.sha, size: entry.size });
      }
    }
    pinned = { commit, tree, committedAt, files };
    return pinned;
  };

  const isValid = (bytes, { sha, size }) =>
    bytes.length === size && gitBlobSha(bytes) === sha;

  const readCached = async (cacheFile, entry) => {
    try {
      const bytes = await fs.readFile(cacheFile);
      return isValid(bytes, entry) ? bytes : null;
    } catch {
      return null;
    }
  };

  const writeCache = async (cacheFile, bytes) => {
    await fs.mkdir(path.dirname(cacheFile), { recursive: true });
    const tmp = `${cacheFile}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;
    await fs.writeFile(tmp, bytes);
    await fs.rename(tmp, cacheFile);
  };

  const readBlob = async (filePath) => {
    if (!pinned) throw new Error("readBlob called before pin()");
    const entry = pinned.files.get(filePath);
    if (!entry) throw new Error(`Path not in pinned tree: ${filePath}`);
    const cacheFile = path.join(
      cacheDir,
      "blobs",
      entry.sha.slice(0, 2),
      entry.sha,
    );
    const cached = await readCached(cacheFile, entry);
    if (cached) {
      stats.cacheHits += 1;
      return cached;
    }
    const bytes = await get(
      `/repos/${repo}/git/blobs/${entry.sha}`,
      "application/vnd.github.raw+json",
      readBytes,
    );
    if (!isValid(bytes, entry)) {
      throw new Error(
        `Blob verification failed for ${filePath} (${entry.sha})`,
      );
    }
    stats.downloads += 1;
    stats.downloadedBytes += bytes.length;
    await writeCache(cacheFile, bytes);
    return bytes;
  };

  const readMany = async (paths) => {
    const results = new Map();
    const queue = [...paths];
    const worker = async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        results.set(next, await readBlob(next));
      }
    };
    const workers = Array.from(
      { length: Math.max(1, Math.min(concurrency, queue.length)) },
      worker,
    );
    await Promise.all(workers);
    return results;
  };

  const assertUnmoved = async () => {
    if (!pinned) throw new Error("assertUnmoved called before pin()");
    const now = await headNow();
    if (now === pinned.commit) return;
    const error = new Error(
      `ROMDex-Data ${branch} moved from ${pinned.commit} to ${now} during the run (the desktop app wrote). Quit the desktop app and repeat the run.`,
    );
    error.code = "HEAD_MOVED";
    throw error;
  };

  return { pin, readBlob, readMany, headNow, assertUnmoved, stats };
};
