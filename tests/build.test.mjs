import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
test("worker inventory covers nested shells and changes with public content", async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), "romdex-build-"));
  try {
    await mkdir(path.join(fixture, "scripts"));
    await mkdir(path.join(fixture, "out/nested"), { recursive: true });
    await copyFile(
      "scripts/service-worker.js",
      path.join(fixture, "scripts/service-worker.js"),
    );
    await writeFile(path.join(fixture, "out/index.html"), "home");
    await writeFile(path.join(fixture, "out/nested/index.html"), "nested");
    await writeFile(path.join(fixture, "out/_headers"), "private policy");
    await writeFile(path.join(fixture, "out/debug.js.map"), "debug map");
    const build = () => {
      const result = spawnSync(
        process.execPath,
        [path.resolve("scripts/build-pwa.mjs")],
        { cwd: fixture, encoding: "utf8" },
      );
      assert.equal(result.status, 0, result.stderr);
    };
    build();
    const first = await readFile(path.join(fixture, "out/sw.js"), "utf8");
    assert.match(first, /\/nested\/index.html/);
    assert.doesNotMatch(first, /private policy|"\/_headers"|debug.js.map/);
    build();
    assert.equal(
      await readFile(path.join(fixture, "out/sw.js"), "utf8"),
      first,
    );
    await writeFile(path.join(fixture, "out/index.html"), "changed");
    build();
    assert.notEqual(
      await readFile(path.join(fixture, "out/sw.js"), "utf8"),
      first,
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
