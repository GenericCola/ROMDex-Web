import assert from "node:assert/strict";
import test from "node:test";
import { taskImage, tileImageSize } from "../../src/rdx/images";
const png = (bytes = 33, width = 1024, height = 512) => {
  const buffer = Buffer.alloc(bytes);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return new File([buffer], "synthetic.png", { type: "image/png" });
};
test("desktop tile size preserves aspect, small sizes and current decode bounds", () => {
  assert.deepEqual(tileImageSize(1024, 512), { width: 192, height: 96 });
  assert.deepEqual(tileImageSize(512, 1024), { width: 96, height: 192 });
  assert.deepEqual(tileImageSize(32, 16), { width: 32, height: 16 });
  assert.deepEqual(tileImageSize(4096, 1), { width: 192, height: 1 });
  for (const [w, h] of [
    [0, 1],
    [-1, 1],
    [1.5, 2],
    [4097, 1],
    [4096, 4096],
    [NaN, 1],
    [Infinity, 1],
  ])
    assert.throws(() => tileImageSize(w, h), /dimensions/);
});
test("8MiB input normalizes through alpha-capable PNG canvas and closes bitmap on success/failure", async (t) => {
  let closes = 0,
    draws = 0,
    decode = 0,
    fail = "";
  const bitmap = {
    width: 1024,
    height: 512,
    close: () => {
      closes++;
    },
  };
  const oldBitmap = Object.getOwnPropertyDescriptor(
    globalThis,
    "createImageBitmap",
  );
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const canvas = {
    width: 0,
    height: 0,
    getContext: (kind: string) => {
      assert.equal(kind, "2d");
      if (fail === "context") return null;
      return {
        drawImage: (...args: unknown[]) => {
          assert.deepEqual(args, [bitmap, 0, 0, 192, 96]);
          draws++;
        },
      };
    },
    toDataURL: (type: string) => {
      assert.equal(type, "image/png");
      if (fail === "encode") throw Error("Encode failed");
      return "data:image/png;base64,c3ludGhldGlj";
    },
  };
  Object.defineProperty(globalThis, "createImageBitmap", {
    configurable: true,
    value: async () => {
      decode++;
      if (fail === "decode") throw Error("Decode failed");
      return bitmap;
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: (tag: string) => {
        assert.equal(tag, "canvas");
        return canvas;
      },
    },
  });
  t.after(() => {
    for (const [key, old] of [
      ["createImageBitmap", oldBitmap],
      ["document", oldDocument],
    ] as const) {
      if (old) Object.defineProperty(globalThis, key, old);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  assert.equal(
    await taskImage(png(8 * 1024 * 1024)),
    "data:image/png;base64,c3ludGhldGlj",
  );
  assert.deepEqual(
    [canvas.width, canvas.height, draws, closes],
    [192, 96, 1, 1],
  );
  await assert.rejects(taskImage(png(8 * 1024 * 1024 + 1)), /8 MiB/);
  await assert.rejects(
    taskImage(new File(["bad"], "bad.png", { type: "image/png" })),
    /Header/,
  );
  await assert.rejects(
    taskImage(new File(["svg"], "bad.svg", { type: "image/svg+xml" })),
    /PNG/,
  );
  await assert.rejects(taskImage(png(33, 4097)), /Dimensions/);
  assert.equal(decode, 1);
  fail = "decode";
  await assert.rejects(taskImage(png()), /Decode failed/);
  assert.equal(closes, 1);
  fail = "context";
  await assert.rejects(taskImage(png()), /preview/);
  fail = "encode";
  await assert.rejects(taskImage(png()), /Encode failed/);
  assert.equal(closes, 3);
  fail = "";
  bitmap.width = 4097;
  await assert.rejects(taskImage(png()), /dimensions/);
  assert.equal(closes, 4);
});
