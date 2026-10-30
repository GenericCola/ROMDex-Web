import assert from "node:assert/strict";
import test from "node:test";
import {
  readNativePlanEvidence,
  type NativePlanReader,
} from "../../src/rdx/native-plan-evidence";
import { normalize } from "../../src/youtrack/read-tasks";
import { rawIssue } from "../fixtures/native-field-delivery";
const ledger = {
  tasks: { task: { issueId: "PMON-1", desired: {} } },
  batches: {},
};
const reader = (): NativePlanReader => ({
  issue: async () => normalize(rawIssue()),
  comments: async () => [],
  files: { list: async () => [], download: async () => new Uint8Array() },
});
void test("native evidence requires stable full inventories and stops on identity invalidation", async () => {
  const port = reader();
  let calls = 0;
  port.issue = async () => ({ ...normalize(rawIssue()), updated: ++calls });
  await assert.rejects(
    readNativePlanEvidence(ledger, port, () => {}),
    /changed during/,
  );
  await assert.rejects(
    readNativePlanEvidence(ledger, reader(), () => {
      throw Error("signed out");
    }),
    /signed out/,
  );
});
void test("native evidence enforces aggregate bytes before download and preserves missing task distinction", async () => {
  const port = reader();
  let downloads = 0;
  port.files.list = async () => [
    {
      id: "1-1",
      name: "big.bin",
      size: 51 * 1024 * 1024,
      mimeType: "application/octet-stream",
      created: 1,
      updated: 1,
      authorId: "1-2",
    },
  ];
  port.files.download = async () => {
    downloads++;
    return new Uint8Array();
  };
  await assert.rejects(
    readNativePlanEvidence(ledger, port, () => {}),
    /read budget/,
  );
  assert.equal(downloads, 0);
  port.issue = async () => null;
  await assert.rejects(
    readNativePlanEvidence(ledger, port, () => {}),
    /missing/,
  );
});
