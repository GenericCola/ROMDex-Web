import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("out");
const walk = async (directory) => {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(file)));
    else files.push(file);
  }
  return files;
};
const files = (await walk(root))
  .filter((file) => !["sw.js", "_headers"].includes(path.basename(file)))
  .sort();
const assets = files.map(
  (file) => "/" + path.relative(root, file).split(path.sep).join("/"),
);
const template = await readFile("scripts/service-worker.js", "utf8");
const hash = createHash("sha256").update(template);
for (let i = 0; i < files.length; i++) {
  hash.update(assets[i]);
  hash.update(await readFile(files[i]));
}
const version = hash.digest("hex").slice(0, 20);
await writeFile(
  path.join(root, "sw.js"),
  template
    .replace("__VERSION__", version)
    .replace("__ASSETS__", JSON.stringify(assets)),
);
console.log("PWA shell:", version, assets.length, "assets");
