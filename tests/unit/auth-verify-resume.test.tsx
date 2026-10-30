import assert from "node:assert/strict";
import test from "node:test";
import type { ResumeRecord } from "../../src/auth/resume-record";
import { verifyResume } from "../../src/auth/verify-resume";
import { YOUTRACK_ORIGIN } from "../../src/youtrack/read-tasks";
const record: ResumeRecord = {
  version: 1,
  instance: YOUTRACK_ORIGIN,
  token: "synthetic-no-access",
  expiresAt: 2000,
  userId: "1-1",
  projectId: "0-1",
};
void test("resume requires fresh matching identity and accessible project; revoked or cancelled reads cannot succeed", async () => {
  const person = {
    id: "1-1",
    name: "Fixture",
    projects: [{ id: "0-1", name: "Project", shortName: "PMON" }],
  };
  const current = () => {
    return undefined;
  };
  let reads = 0;
  const read = () => {
    reads++;
    return Promise.resolve(person);
  };
  assert.deepEqual(
    await verifyResume(record, read, current, () => {
      return 1000;
    }),
    {
      identity: person,
      project: person.projects[0],
    },
  );
  assert.equal(reads, 1);
  await assert.rejects(
    verifyResume(
      record,
      () => {
        return Promise.resolve({ ...person, id: "1-2" });
      },
      current,
      () => {
        return 1000;
      },
    ),
    /different account/,
  );
  await assert.rejects(
    verifyResume(
      record,
      () => {
        return Promise.resolve({ ...person, projects: [] });
      },
      current,
      () => {
        return 1000;
      },
    ),
    /no longer available/,
  );
  await assert.rejects(
    verifyResume(
      record,
      () => {
        return Promise.reject(Error("HTTP401"));
      },
      current,
      () => {
        return 1000;
      },
    ),
    /HTTP401/,
  );
  let now = 1000;
  await assert.rejects(
    verifyResume(
      record,
      () => {
        now = 2000;
        return Promise.resolve(person);
      },
      current,
      () => {
        return now;
      },
    ),
    /expired/,
  );
  let active = true;
  await assert.rejects(
    verifyResume(
      record,
      () => {
        active = false;
        return Promise.resolve(person);
      },
      () => {
        if (!active) throw Error("cancelled");
      },
      () => {
        return 1000;
      },
    ),
    /cancelled/,
  );
});
