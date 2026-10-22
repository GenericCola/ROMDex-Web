import { readFile } from "node:fs/promises";
import sharp from "sharp";
const source = await readFile("public/icons/source.svg");
for (const [name, size] of [
  ["icon-192", 192],
  ["icon-512", 512],
  ["maskable-512", 512],
  ["apple-touch-icon", 180],
])
  await sharp(source)
    .resize(size, size)
    .png()
    .toFile("public/icons/" + name + ".png");
