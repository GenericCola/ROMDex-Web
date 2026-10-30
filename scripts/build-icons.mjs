import { readFile } from "node:fs/promises";
import sharp from "sharp";
// Exact desktop RD08 artwork is a 16×16 pixel grid. Never smooth or redraw it.
const source = await sharp(await readFile("public/icons/source.svg"))
  .resize(16, 16, { kernel: "nearest" })
  .png()
  .toBuffer();
for (const [name, size] of [
  ["icon-192", 192],
  ["icon-512", 512],
  ["apple-touch-icon", 180],
])
  await sharp(source)
    .resize(size, size, { kernel: "nearest" })
    .png()
    .toFile("public/icons/" + name + ".png");
// 288px artwork fits completely within the 512px icon's central 80% circle.
// Only the maskable variant adds padding and the existing desktop red background.
const maskable = await sharp(source)
  .resize(288, 288, { kernel: "nearest" })
  .png()
  .toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#a92032" },
})
  .composite([{ input: maskable, top: 112, left: 112 }])
  .png()
  .toFile("public/icons/maskable-512.png");
