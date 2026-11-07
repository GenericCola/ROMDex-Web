import assert from "node:assert/strict";
import test from "node:test";
import { restoreSession } from "../../src/auth/restore-session";
import { RESUME_KEY, writeResumeRecord } from "../../src/auth/resume-record";
import { deliveryConnected, disconnectDelivery } from "../../src/cloud/session";
import { YouTrackHttpError } from "../../src/youtrack/http-error";
import { YOUTRACK_ORIGIN } from "../../src/youtrack/read-tasks";
import { memoryStorage } from "../fixtures/memory-storage";
const project = { id: "0-1", name: "Fixture", shortName: "PMON" };
const identity = { id: "1-1", name: "Fixture", projects: [project] };
const fixture = () => {
  const storage = memoryStorage(),
    { values } = storage;
  const record: import("../../src/auth/resume-record").ResumeRecord = {
    version: 1 as const,
    instance: YOUTRACK_ORIGIN,
    token: "synthetic-no-access",
    expiresAt: Date.now() + 60000,
    userId: identity.id,
    projectId: project.id,
  };
  writeResumeRecord(storage, record);
  return { storage, record, values };
};
const current = () => {
  return undefined;
};
const read = () => {
  return Promise.resolve(identity);
};
void test("reload revalidates identity then project before exposing workspace, without delivery", async () => {
  const { storage, record } = fixture();
  disconnectDelivery();
  const calls: string[] = [];
  const person = () => {
    calls.push("identity");
    return read();
  };
  const open = (
    token: string,
    user: string,
    selected: typeof project,
    valid: () => boolean,
  ) => {
    calls.push("project");
    assert.equal(token, record.token);
    assert.equal(user, identity.id);
    assert.deepEqual(selected, project);
    assert.equal(valid(), true);
    return Promise.resolve([]);
  };
  for (let reload = 0; reload < 2; reload++) {
    const restored = await restoreSession(storage, current, person, open);
    assert.equal(restored?.identity.id, identity.id);
    assert.equal(restored?.project?.id, project.id);
    assert.equal(deliveryConnected(), false);
  }
  assert.deepEqual(calls, ["identity", "project", "identity", "project"]);
});
void test("revocation, changed account or project, and project failure clear resume and never expose workspace", async () => {
  for (const mode of ["revoked", "account", "project", "open"]) {
    const { storage, values } = fixture();
    values.set("local-draft", "preserved");
    let opens = 0;
    const person = () => {
      if (mode === "revoked") throw new YouTrackHttpError(401);
      return Promise.resolve(
        mode === "account"
          ? { ...identity, id: "1-2" }
          : mode === "project"
            ? { ...identity, projects: [] }
            : identity,
      );
    };
    const open = () => {
      opens++;
      throw new YouTrackHttpError(403);
    };
    await assert.rejects(restoreSession(storage, current, person, open));
    assert.equal(opens, mode === "open" ? 1 : 0);
    assert.equal(values.has(RESUME_KEY), false);
    assert.equal(values.get("local-draft"), "preserved");
  }
});
void test("cancelled permission/project reads cannot restore or erase newer login", async () => {
  for (const phase of ["identity", "project"]) {
    const { storage, record, values } = fixture();
    let active = true;
    const check = () => {
      if (!active) throw Error("Changed session");
    };
    const cancel = () => {
      active = false;
      writeResumeRecord(storage, { ...record, userId: "1-2" });
    };
    const person = () => {
      if (phase === "identity") cancel();
      return read();
    };
    const open = () => {
      cancel();
      return Promise.resolve([]);
    };
    await assert.rejects(
      restoreSession(storage, check, person, open),
      /Changed/,
    );
    assert.equal(JSON.parse(values.get(RESUME_KEY) ?? "{}").userId, "1-2");
  }
});
void test("expired record is erased without network and expiry during opening fails closed", async () => {
  const { storage, record, values } = fixture();
  values.set(RESUME_KEY, JSON.stringify({ ...record, expiresAt: 1 }));
  const unexpected = () => {
    throw Error("Network must not run");
  };
  assert.equal(await restoreSession(storage, current, unexpected), null);
  writeResumeRecord(storage, record);
  const original = Date.now;
  try {
    const open = () => {
      Date.now = () => {
        return record.expiresAt;
      };
      return Promise.resolve([]);
    };
    await assert.rejects(
      restoreSession(storage, current, read, open),
      /expired/,
    );
    assert.equal(values.has(RESUME_KEY), false);
  } finally {
    Date.now = original;
  }
});

void test("transient teammate identity or workspace failures retain original expiry and retry without OAuth", async () => {
  for (const phase of ["identity", "project"]) {
    const { storage, values, record } = fixture();
    let failed = true;
    const person = async () => {
      if (failed && phase === "identity") throw new TypeError("Network failed");
      return identity;
    };
    const open = async () => {
      if (failed && phase === "project")
        throw Error("Local workspace temporarily unavailable");
      return [];
    };
    await assert.rejects(
      restoreSession(storage, current, person, open),
      /Retry verification/,
    );
    assert.equal(
      JSON.parse(values.get(RESUME_KEY)!).expiresAt,
      record.expiresAt,
    );
    failed = false;
    const result = await restoreSession(storage, current, person, open);
    assert.equal(result?.identity.id, identity.id);
    assert.equal(result?.record.expiresAt, record.expiresAt);
  }
});

void test("typed HTTP rejection clears retained token while server errors remain retryable", async () => {
  for (const status of [401, 403, 429, 500, 503]) {
    const { storage, values } = fixture();
    const fail = async () => {
      throw new YouTrackHttpError(status);
    };
    await assert.rejects(restoreSession(storage, current, fail));
    assert.equal(values.has(RESUME_KEY), status !== 401 && status !== 403);
  }
});
