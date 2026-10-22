import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { crc32 } from "node:zlib";
const files = [
  "manifest.json",
  "entity-extensions.json",
  "status.js",
  "status-record.js",
  "status-rules.js",
];
const manifest = JSON.parse(
  await readFile(
    new URL("../youtrack-app/manifest.json", import.meta.url),
    "utf8",
  ),
);
if (
  manifest.name !== "romdex-status" ||
  !/^\d+\.\d+\.\d+$/.test(manifest.version)
)
  throw Error("Invalid app manifest.");
const entries = [],
  directory = [];
let offset = 0;
// Node 24 supplies CRC32 but no ZIP writer; this package has five fixed, uncompressed entries.
for (const file of files) {
  const name = Buffer.from(file),
    data = await readFile(new URL("../youtrack-app/" + file, import.meta.url));
  const local = Buffer.alloc(30),
    central = Buffer.alloc(46);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(33, 12);
  local.writeUInt32LE(crc32(data), 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(33, 14);
  central.writeUInt32LE(crc32(data), 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(offset, 42);
  entries.push(local, name, data);
  directory.push(central, name);
  offset += local.length + name.length + data.length;
}
const central = Buffer.concat(directory),
  end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(central.length, 12);
end.writeUInt32LE(offset, 16);
const zip = Buffer.concat([...entries, central, end]),
  filename = "romdex-status-" + manifest.version + ".zip";
await mkdir(new URL("../artifacts/", import.meta.url), { recursive: true });
await writeFile(new URL("../artifacts/" + filename, import.meta.url), zip);
const checksum = createHash("sha256").update(zip).digest("hex");
await writeFile(
  new URL("../artifacts/" + filename + ".sha256", import.meta.url),
  checksum + "  " + filename + "\n",
);
console.log(
  "Packaged artifacts/" +
    filename +
    " (" +
    files.length +
    " files, SHA-256 " +
    checksum +
    ")",
);
