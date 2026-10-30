import assert from "node:assert/strict";
import test from "node:test";
import {
  droppedFiles,
  isFileDrag,
} from "../../src/domain/accepted/file-drop.mjs";
const transfer = (files: File[], items: unknown[] = []) => {
  return { types: ["Files"], files, items } as unknown as DataTransfer;
};
void test("original desktop drop parser accepts file-only transfers and rejects folders, text and oversized counts", () => {
  const file = new File(["fixture"], "fixture.txt");
  assert.equal(isFileDrag(transfer([file])), true);
  assert.equal(isFileDrag({ types: ["text/plain"] }), false);
  assert.deepEqual(droppedFiles(transfer([file])), [file]);
  assert.throws(() => {
    droppedFiles(
      transfer(
        [file],
        [
          {
            kind: "file",
            webkitGetAsEntry: () => {
              return { isDirectory: true };
            },
          },
        ],
      ),
    );
  }, /Folders/);
  assert.throws(() => {
    droppedFiles(transfer([file], [{ kind: "string" }]));
  }, /Mixed Text/);
  assert.throws(() => {
    droppedFiles(
      transfer(
        Array.from({ length: 11 }, () => {
          return file;
        }),
      ),
    );
  }, /1–10/);
});
