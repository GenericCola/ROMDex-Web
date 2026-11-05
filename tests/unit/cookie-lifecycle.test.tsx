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
      assert.deepEqual(f.identities, [null]);
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
    assert.equal(f.identities.filter(Boolean).length, 1);
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
    assert.deepEqual(f.identities, [null]);
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

test("cookie resume defaults to PMON and preserves an authorized account-specific choice", async () => {
  for (const saved of [null, "other", "revoked"]) {
    const f = fixture();
    let stop = () => {};
    const opened: string[] = [];
    try {
      if (saved) f.values.set("romdex-cookie-project-v1:fixture", saved);
      f.values.set("romdex-cookie-project-v1:another-account", "other");
      globalThis.fetch = async () =>
        Response.json({
          userId: "fixture",
          projects: [
            { id: "other", name: "Other", shortName: "OTHER" },
            { id: "pmon", name: "PMON", shortName: "PMON" },
          ],
          csrf: "synthetic",
          expiresAt: Date.now() / 1000 + 300,
        });
      stop = startCookieResume(
        f.options,
        async (_auth, _user, project, current) => {
          assert.equal(current(), true);
          opened.push(project.id);
          return { items: [], warning: "" };
        },
      );
      await f.done;
      assert.deepEqual(opened, [saved === "other" ? "other" : "pmon"]);
      assert.equal(f.values.get("draft"), "Keep this draft");
    } finally {
      stop();
      f.cleanup();
    }
  }
});

test("cookie resume works when optional browser storage is unavailable", async () => {
  const f = fixture();
  let stop = () => {};
  const opened: string[] = [];
  try {
    Object.defineProperty(window, "sessionStorage", {
      get: () => {
        throw Error("Storage denied");
      },
    });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: () => {
        throw Error("Storage denied");
      },
    });
    globalThis.fetch = async () =>
      Response.json({
        userId: "fixture",
        projects: [
          { id: "other", name: "Other", shortName: "OTHER" },
          { id: "pmon", name: "PMON", shortName: "PMON" },
        ],
        csrf: "synthetic",
        expiresAt: Date.now() / 1000 + 300,
      });
    stop = startCookieResume(f.options, async (_auth, _user, project) => {
      opened.push(project.id);
      return { items: [], warning: "" };
    });
    await f.done;
    assert.deepEqual(opened, ["pmon"]);
    assert.equal(f.identities.filter(Boolean).length, 1);
    assert.equal(f.messages.at(-1), "");
  } finally {
    stop();
    f.cleanup();
  }
});

const projectSession = () =>
  Response.json({
    userId: "fixture",
    projects: [
      { id: "other", name: "Other", shortName: "OTHER" },
      { id: "pmon", name: "PMON", shortName: "PMON" },
    ],
    csrf: "synthetic",
    expiresAt: Date.now() / 1000 + 300,
  });

test("cookie resume publishes no identity or chooser while the preferred project is opening", async () => {
  const f = fixture();
  let stop = () => {},
    release = () => {},
    entered = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const opening = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const selected: unknown[] = [];
  try {
    globalThis.fetch = async () => projectSession();
    stop = startCookieResume(
      {
        ...f.options,
        setSelected: (value) => {
          selected.push(value);
        },
      },
      async () => {
        entered();
        await pending;
        return { items: [], warning: "" };
      },
    );
    await opening;
    assert.deepEqual(f.identities, [null]);
    assert.deepEqual(selected, [null]);
    assert.deepEqual(f.busy, [true]);
    release();
    await f.done;
    assert.equal(f.identities.filter(Boolean).length, 1);
    assert.deepEqual(selected.at(-1), {
      id: "pmon",
      name: "PMON",
      shortName: "PMON",
    });
    assert.deepEqual(f.busy, [true, false]);
  } finally {
    release();
    stop();
    f.cleanup();
  }
});

test("failed automatic PMON opening clears partial access and exposes retry without the chooser", async () => {
  const f = fixture();
  let stop = () => {},
    retry = false;
  try {
    globalThis.fetch = async () => projectSession();
    stop = startCookieResume(
      {
        ...f.options,
        setRetryable: (value) => {
          retry = value;
        },
      },
      async () => {
        throw Error("Synthetic project read failed");
      },
    );
    await f.done;
    assert.equal(retry, true);
    assert.deepEqual(f.identities, [null]);
    assert.equal(f.options.sessionRef.current, null);
    assert.match(
      f.messages.at(-1)!,
      /^Could not open PMON\. Synthetic project read failed/,
    );
    assert.equal(f.values.get("draft"), "Keep this draft");
    assert.equal(f.values.get("romdex-cookie-project-v1:fixture"), "pmon");
    let finish = () => {};
    const retried = new Promise<void>((resolve) => {
      finish = resolve;
    });
    stop();
    stop = startCookieResume(
      {
        ...f.options,
        setBusy: (value) => {
          if (!value) finish();
        },
      },
      async () => ({ items: [], warning: "" }),
    );
    await retried;
    assert.equal(f.identities.filter(Boolean).length, 1);
    assert.equal(f.values.get("draft"), "Keep this draft");
  } finally {
    stop();
    f.cleanup();
  }
});

test("expiry or a new account during project opening cannot publish stale workspace access", async () => {
  for (const change of ["expiry", "account"] as const) {
    const f = fixture(),
      now = Date.now;
    let stop = () => {};
    try {
      globalThis.fetch = async () => projectSession();
      stop = startCookieResume(f.options, async () => {
        if (change === "expiry") Date.now = () => now() + 301000;
        else document.cookie = "__Host-romdex-generation=" + "b".repeat(43);
        return { items: [], warning: "" };
      });
      await f.done;
      assert.deepEqual(f.identities, [null]);
      assert.equal(f.options.sessionRef.current, null);
      assert.match(f.messages.at(-1)!, /^Could not open PMON\./);
      assert.equal(f.values.get("draft"), "Keep this draft");
    } finally {
      Date.now = now;
      stop();
      f.cleanup();
    }
  }
});

test("cancelling a pending project open cannot publish its late identity or selection", async () => {
  const f = fixture();
  let release = () => {},
    entered = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const opening = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const selected: unknown[] = [];
  try {
    globalThis.fetch = async () => projectSession();
    const stop = startCookieResume(
      {
        ...f.options,
        setSelected: (value) => {
          selected.push(value);
        },
      },
      async () => {
        entered();
        await pending;
        return { items: [], warning: "" };
      },
    );
    await opening;
    stop();
    release();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(f.identities, [null]);
    assert.deepEqual(selected, [null]);
    assert.equal(f.options.sessionRef.current, null);
    assert.deepEqual(f.busy, [true]);
  } finally {
    release();
    f.cleanup();
  }
});
