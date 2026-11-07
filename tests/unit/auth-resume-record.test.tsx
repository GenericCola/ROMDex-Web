import assert from "node:assert/strict";
import test from "node:test";
import {
  RESUME_KEY,
  clearResumeRecord,
  readResumeRecord,
  writeResumeRecord,
  type ResumeRecord,
} from "../../src/auth/resume-record";
import { YOUTRACK_ORIGIN } from "../../src/youtrack/read-tasks";
import { memoryStorage } from "../fixtures/memory-storage";
const record: ResumeRecord = {
  version: 1,
  instance: YOUTRACK_ORIGIN,
  token: "synthetic-no-access",
  expiresAt: 2000,
  userId: "1-1",
  projectId: "0-1",
};
const storage = () => {
  return memoryStorage([["unrelated", "keep"]]);
};
void test("resume records retain only the existing short-lived session and preserve unrelated storage", () => {
  const local = storage();
  writeResumeRecord(
    local,
    { ...record, refreshToken: "must-not-persist" } as ResumeRecord,
    1000,
  );
  assert.deepEqual(readResumeRecord(local, 1000), record);
  assert.ok(!local.values.get(RESUME_KEY)?.includes("must-not-persist"));
  clearResumeRecord(local);
  assert.equal(readResumeRecord(local, 1000), null);
  assert.equal(local.values.get("unrelated"), "keep");
});
void test("expired, malformed and wrong-instance records fail closed and are removed", () => {
  for (const value of [
    "broken",
    JSON.stringify({ ...record, expiresAt: 1000 }),
    JSON.stringify({ ...record, instance: "https://other.invalid" }),
    JSON.stringify({ ...record, token: "bad\nvalue" }),
    JSON.stringify({ ...record, userId: "../other" }),
  ]) {
    const local = storage();
    local.values.set(RESUME_KEY, value);
    assert.equal(readResumeRecord(local, 1000), null);
    assert.equal(local.values.has(RESUME_KEY), false);
  }
  assert.throws(() => {
    return writeResumeRecord(storage(), record, 2000);
  }, /cannot be resumed/);
});
void test("blocked storage never fabricates a resumable session", () => {
  const denied = () => {
    throw Error("storage unavailable");
  };
  assert.throws(() => {
    return readResumeRecord(
      { getItem: denied, setItem: denied, removeItem: denied },
      1000,
    );
  }, /unavailable/);
});
