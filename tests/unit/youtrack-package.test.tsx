import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { crc32 } from "node:zlib";
import { buildYouTrackArchive } from "../../scripts/package-youtrack.mjs";
const { version: acceptanceVersion } = JSON.parse(
  readFileSync("youtrack-acceptance/scope.json", "utf8"),
);

test("installable app ZIP contains only the exact backend sources with valid CRCs and deterministic checksum", async () => {
  const built = await buildYouTrackArchive();
  const zip = built.zip;
  let at = 0;
  const names: string[] = [];
  while (zip.readUInt32LE(at) === 0x04034b50) {
    assert.equal(zip.readUInt16LE(at + 8), 0);
    const size = zip.readUInt32LE(at + 18),
      length = zip.readUInt16LE(at + 26),
      name = zip.subarray(at + 30, at + 30 + length).toString();
    names.push(name);
    const bytes = zip.subarray(at + 30 + length, at + 30 + length + size);
    assert.equal(crc32(bytes), zip.readUInt32LE(at + 14));
    assert.deepEqual(bytes, readFileSync("youtrack-app/" + name));
    at += 30 + length + size;
  }
  assert.deepEqual(names, [
    "manifest.json",
    "entity-extensions.json",
    "status.js",
    "capabilities.js",
    "status-record.js",
    "status-rules.js",
  ]);
  assert.equal(zip.readUInt32LE(at), 0x02014b50);
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
  assert.equal(zip.readUInt16LE(zip.length - 12), 6);
  const sum = createHash("sha256").update(zip).digest("hex");
  assert.equal(built.checksum, sum);
  assert.deepEqual((await buildYouTrackArchive()).zip, zip);
});

test("acceptance package isolates the two explicitly authorized NPCD fixtures and rejects production", async () => {
  const built = await buildYouTrackArchive({ acceptance: true });
  const zip = built.zip,
    files = new Map<string, Buffer>();
  let at = 0;
  while (zip.readUInt32LE(at) === 0x04034b50) {
    const size = zip.readUInt32LE(at + 18),
      length = zip.readUInt16LE(at + 26),
      name = zip.subarray(at + 30, at + 30 + length).toString();
    files.set(name, zip.subarray(at + 30 + length, at + 30 + length + size));
    at += 30 + length + size;
  }
  const manifest = JSON.parse(files.get("manifest.json")!.toString());
  assert.equal(manifest.name, "romdex-status-acceptance");
  assert.equal(manifest.widgets.length, 1);
  assert.ok(files.has("fault.js"));
  assert.equal(manifest.version, acceptanceVersion);
  assert.ok(files.has("widgets/acceptance/panel.js"));
  for (const widget of manifest.widgets) {
    assert.ok(
      files.has("widgets/" + widget.indexPath),
      "widget index resolves relative to widgets/",
    );
  }
  assert.ok(
    files
      .get("widgets/acceptance/index.html")!
      .toString()
      .includes('src="panel.js"'),
  );
  assert.ok(!files.has("acceptance/index.html"));
  assert.deepEqual(
    files.get("entity-extensions.json"),
    readFileSync("youtrack-app/entity-extensions.json"),
  );
  for (const name of ["status-record.js", "status-rules.js"]) {
    const source = files.get(name)!.toString();
    assert.ok(!source.includes("module.exports"));
    assert.equal(source, readFileSync("youtrack-app/" + name, "utf8"));
    const exported = {};
    runInNewContext(source, { exports: exported }, { filename: name });
    assert.ok(Object.keys(exported).length > 0);
  }
  const exported: {
    httpHandler?: {
      endpoints: {
        scope: string;
        method: string;
        handle: (ctx: unknown) => void;
      }[];
    };
  } = {};
  const require = createRequire(
    new URL("../../youtrack-app/status.js", import.meta.url),
  );
  new Function("require", "exports", files.get("status.js")!.toString())(
    require,
    exported,
  );
  const endpoints = exported.httpHandler!.endpoints;
  for (const [id, summary, project, expected] of [
    ["NPCD-872", "[ROMDex acceptance] Root", "NPCD", 200],
    ["NPCD-873", "[ROMDex acceptance] Child", "NPCD", 200],
    ["NPCD-874", "[ROMDex acceptance] Other", "NPCD", 403],
    ["NPCD-872", "Existing NPCD task", "NPCD", 403],
    ["PMON-1", "[ROMDex acceptance] Root", "PMON", 403],
  ]) {
    let result: unknown;
    const response = {
      code: 200,
      addHeader: () => {},
      json: (value: unknown) => {
        result = value;
      },
    };
    const issue = {
      id,
      summary,
      updated: 1,
      isReported: true,
      isVisibleTo: () => true,
      project: {
        shortName: project,
        findFieldByName: () => ({
          typeName: "state[1]",
          isVisibleInIssue: () => true,
        }),
      },
      fields: { canBeReadBy: () => true, State: { name: "Open" } },
      extensionProperties: { assignedStatus: null },
    };
    endpoints
      .find((entry) => entry.scope === "issue" && entry.method === "GET")!
      .handle({ issue, currentUser: {}, response });
    assert.equal(response.code, expected, id + " guard");
    assert.ok(result);
  }
  assert.throws(() =>
    execFileSync(
      process.execPath,
      ["scripts/package-youtrack.mjs", "--acceptance", "PMON"],
      { stdio: "pipe" },
    ),
  );
});

test("HTTP modules never mix global and project entity scopes", () => {
  const require = createRequire(import.meta.url);
  for (const name of ["status", "capabilities"]) {
    const endpoints = require("../../youtrack-app/" + name + ".js").httpHandler
      .endpoints as { scope: string }[];
    const families = new Set(
      endpoints.map((endpoint) =>
        ["global", "user"].includes(endpoint.scope) ? "global" : "project",
      ),
    );
    assert.equal(families.size, 1, name + " scope family");
  }
});
