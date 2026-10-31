import assert from "node:assert/strict";
import test from "node:test";
import { RESUME_KEY } from "../../src/auth/resume-record";
import { cookieSignOut } from "../../src/components/romdex/cookie-sign-out";
import { startCookieResume } from "../../src/components/romdex/start-cookie-resume";

const fixture = () => {
  const names = ["document", "window", "localStorage"] as const;
  const descriptors = names.map((name) =>
    Object.getOwnPropertyDescriptor(globalThis, name),
  );
  const fetch = globalThis.fetch;
  const values = new Map([
    [RESUME_KEY, "synthetic legacy record"],
    ["draft", "Keep this draft"],
  ]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  for (const [name, value] of Object.entries({
    document: { cookie: "__Host-romdex-generation=" + "a".repeat(43) },
    window: {
      location: { origin: "https://romdex.vercel.app" },
      sessionStorage: storage,
    },
    localStorage: storage,
  }))
    Object.defineProperty(globalThis, name, { configurable: true, value });
  const busy: boolean[] = [],
    messages: string[] = [],
    identities: unknown[] = [];
  let finish = () => {};
  const done = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const options: Parameters<typeof startCookieResume>[0] = {
    sessionRef: { current: null },
    generationRef: { current: 0 },
    setBusy: (value) => {
      busy.push(value);
      if (!value) finish();
    },
    setMessage: (value) => {
      messages.push(value);
    },
    setIdentity: (value) => {
      identities.push(value);
    },
    setSelected: () => {},
    setIssues: () => {},
    setRetryable: () => {},
  };
  const cleanup = () => {
    globalThis.fetch = fetch;
    names.forEach((name, i) => {
      const descriptor = descriptors[i];
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    });
  };
  return { values, busy, messages, identities, options, done, cleanup };
};

test("current cookie resume releases busy on anonymous and expired replies without removing local work", async () => {
  for (const expired of [false, true]) {
    const f = fixture();
    let stop = () => {};
    try {
      globalThis.fetch = async () =>
        expired
          ? Response.json({
              userId: "fixture",
              projects: [],
              csrf: "synthetic",
              expiresAt: 1,
            })
          : new Response(null, { status: 401 });
      stop = startCookieResume(f.options);
      await f.done;
      assert.deepEqual(f.busy, [true, false]);
      assert.deepEqual(f.identities, []);
      assert.equal(f.values.get("draft"), "Keep this draft");
      assert.equal(f.values.has(RESUME_KEY), true);
      if (expired) assert.match(f.messages.at(-1)!, /Invalid server sign-in/);
    } finally {
      stop();
      f.cleanup();
    }
  }
});

test("verified cookie resume removes only legacy auth record and preserves drafts", async () => {
  const f = fixture();
  let stop = () => {};
  try {
    globalThis.fetch = async () =>
      Response.json({
        userId: "fixture",
        projects: [],
        csrf: "synthetic",
        expiresAt: Date.now() / 1000 + 300,
      });
    stop = startCookieResume(f.options);
    await f.done;
    assert.deepEqual(f.busy, [true, false]);
    assert.equal(f.identities.length, 1);
    assert.equal(f.values.has(RESUME_KEY), false);
    assert.equal(f.values.get("draft"), "Keep this draft");
  } finally {
    stop();
    f.cleanup();
  }
});

test("cancelled cookie resume cannot expose a late identity or migrate local auth", async () => {
  const f = fixture();
  try {
    let resolve!: (response: Response) => void;
    globalThis.fetch = () =>
      new Promise<Response>((done) => {
        resolve = done;
      });
    const stop = startCookieResume(f.options);
    stop();
    resolve(
      Response.json({
        userId: "late",
        projects: [],
        csrf: "synthetic",
        expiresAt: Date.now() / 1000 + 300,
      }),
    );
    await new Promise<void>((done) => setImmediate(done));
    assert.deepEqual(f.identities, []);
    assert.equal(f.options.sessionRef.current, null);
    assert.equal(f.values.has(RESUME_KEY), true);
    assert.equal(f.values.get("draft"), "Keep this draft");
  } finally {
    f.cleanup();
  }
});

test("logout local persistence failure preserves identity and never sends logout", async () => {
  const f = fixture();
  let cleared = 0,
    calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      return new Response();
    };
    await cookieSignOut(
      async () => {
        throw Error("Synthetic local save failure");
      },
      () => {
        cleared++;
      },
      f.options.setBusy,
      f.options.setMessage,
    );
    assert.equal(cleared, 0);
    assert.equal(calls, 0);
    assert.deepEqual(f.busy, [true, false]);
    assert.match(f.messages.at(-1)!, /local save failure/);
    assert.equal(f.values.get("draft"), "Keep this draft");
  } finally {
    f.cleanup();
  }
});
