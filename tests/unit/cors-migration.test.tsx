import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCorsMigration,
  CORS_MIGRATION_ORIGIN,
  readCorsMigration,
} from "../../src/auth/cors-migration";
import type { YouTrackRequest } from "../../src/youtrack/request";
const old = ["https://romdex-web.vercel.app", "https://other.example"];
const fixture = (responses: unknown[]) => {
  const calls: { route: string; method: string; body: unknown }[] = [];
  const request: YouTrackRequest = (route, method = "GET", body) => {
    calls.push({ route, method, body });
    const value = responses.shift();
    return value instanceof Error
      ? Promise.reject(value)
      : Promise.resolve(value);
  };
  return { request, calls };
};
const settings = (origins = old) => {
  return {
    allowAllOrigins: false,
    allowedOrigins: origins,
  };
};
void test("CORS migration appends only the fixed origin and requires exact readback", async () => {
  const proposed = [...old, CORS_MIGRATION_ORIGIN];
  const f = fixture([settings(), settings(), {}, settings(proposed)]);
  const preview = await readCorsMigration(f.request);
  assert.deepEqual(preview.baseline, old);
  assert.deepEqual(preview.proposed, proposed);
  assert.equal(
    (await applyCorsMigration(f.request, preview)).status,
    "verified",
  );
  assert.deepEqual(
    f.calls.map((call) => {
      return call.method;
    }),
    ["GET", "GET", "POST", "GET"],
  );
  assert.deepEqual(f.calls[2]?.body, settings(proposed));
  assert.ok(
    f.calls.every((call) => {
      return (
        call.route ===
        "admin/globalSettings/restSettings?fields=allowAllOrigins,allowedOrigins"
      );
    }),
  );
  await assert.rejects(applyCorsMigration(f.request, preview));
  assert.equal(f.calls.length, 4);
});
void test("CORS invalid wildcards or allow-all settings fail closed", async () => {
  for (const bad of [
    null,
    {},
    { allowAllOrigins: true, allowedOrigins: old },
    settings(["*"]),
    settings(["https://*.example"]),
    settings(["https://example/path"]),
  ]) {
    const f = fixture([bad]);
    await assert.rejects(readCorsMigration(f.request));
    assert.equal(f.calls.length, 1);
  }
});
void test("changed baseline and altered proposed target never dispatch", async () => {
  const changed = fixture([settings(), settings([...old].reverse())]);
  const preview = await readCorsMigration(changed.request);
  await assert.rejects(
    applyCorsMigration(changed.request, preview),
    /changed since review/,
  );
  assert.ok(
    changed.calls.every((call) => {
      return call.method === "GET";
    }),
  );
  preview.proposed.push("https://unapproved.example");
  await assert.rejects(applyCorsMigration(changed.request, preview));
  assert.equal(changed.calls.length, 2);
});
void test("post-dispatch timeout and mismatched readback are uncertain with no retries", async () => {
  for (const outcomes of [
    [new Error("timeout")],
    [{}, new Error("readback timeout")],
    [{}, settings()],
  ]) {
    const f = fixture([settings(), settings(), ...outcomes]);
    const preview = await readCorsMigration(f.request);
    assert.equal(
      (await applyCorsMigration(f.request, preview)).status,
      "uncertain",
    );
    await assert.rejects(applyCorsMigration(f.request, preview));
    assert.equal(
      f.calls.filter((call) => {
        return call.method === "POST";
      }).length,
      1,
    );
  }
});
void test("already configured target is read-only and preserves the original list", async () => {
  const f = fixture([settings([...old, CORS_MIGRATION_ORIGIN])]);
  const preview = await readCorsMigration(f.request);
  assert.equal(preview.needed, false);
  await assert.rejects(applyCorsMigration(f.request, preview));
  assert.equal(f.calls.length, 1);
});
