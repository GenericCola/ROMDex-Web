import assert from "node:assert/strict";
import test from "node:test";
import { validateStageFiles } from "../../src/attachments/stage-files";
void test("desktop-sized multi-file selection validates every file before staging", () => {
  const file = new File(["fixture"], "fixture.txt", { type: "text/plain" });
  assert.doesNotThrow(() => {
    validateStageFiles([file, file]);
  });
  assert.throws(() => {
    validateStageFiles([]);
  }, /1 and 10/);
  assert.throws(() => {
    validateStageFiles(
      Array.from({ length: 11 }, () => {
        return file;
      }),
    );
  }, /1 and 10/);
  assert.throws(() => {
    validateStageFiles([file, new File(["unsafe"], "../bad.txt")]);
  }, /filename/);
});
void test("new file batches preserve the verified cloud and local byte limits", () => {
  const large = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.bin");
  assert.throws(() => {
    validateStageFiles([large]);
  }, /10 MiB/);
  const file = new File([new Uint8Array(10 * 1024 * 1024)], "limit.bin");
  assert.throws(() => {
    validateStageFiles(
      Array.from({ length: 7 }, () => {
        return file;
      }),
    );
  }, /64 MiB/);
});
