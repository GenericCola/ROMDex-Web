import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";
const hash = (bytes: Buffer) => {
  return createHash("sha256").update(bytes).digest("hex");
};
const originalSvg =
  "4bcc7c4424ec65ad6b4fb2a5284d9370699057cc5342ae76e17b36e07639c973";
void test("favicon and source art are the exact desktop RD08 assets, not template branding", async () => {
  assert.equal(
    hash(await readFile("public/favicon.ico")),
    "36655b2b66acb932ab4973a85e027e0224a9595deea72c17c69b2d89e16c9c6e",
  );
  assert.equal(hash(await readFile("src/app/icon.svg")), originalSvg);
  assert.equal(hash(await readFile("public/icons/source.svg")), originalSvg);
  const base = await sharp("public/icons/source.svg")
    .resize(16, 16)
    .png()
    .toBuffer();
  const pixels = await sharp(base)
    .resize(256, 256, { kernel: "nearest" })
    .raw()
    .toBuffer();
  assert.equal(
    hash(pixels),
    "0691a026f84a12510518a7414e2499e34510a833e038142306d5b1cd9fbd2087",
  );
});
void test("standard install sizes preserve the desktop pixel art and transparency without smoothing", async () => {
  const base = await sharp("public/icons/source.svg")
    .resize(16, 16)
    .png()
    .toBuffer();
  for (const [name, size] of [
    ["icon-192", 192],
    ["icon-512", 512],
    ["apple-touch-icon", 180],
  ] as const) {
    const actual = await sharp("public/icons/" + name + ".png")
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(actual.info.width, size);
    assert.equal(actual.info.height, size);
    const expected = await sharp(base)
      .resize(size, size, { kernel: "nearest" })
      .ensureAlpha()
      .raw()
      .toBuffer();
    assert.deepEqual(actual.data, expected);
    assert.equal(actual.data[3], 0);
  }
});
void test("maskable icon keeps all artwork inside the safe circle on the desktop background", async () => {
  const { data, info } = await sharp("public/icons/maskable-512.png")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 512);
  assert.equal(info.height, 512);
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4;
      assert.equal(data[i + 3], 255);
      if (data[i] !== 169 || data[i + 1] !== 32 || data[i + 2] !== 50)
        assert.ok(Math.hypot(x + 0.5 - 256, y + 0.5 - 256) < 204.8);
    }
});
