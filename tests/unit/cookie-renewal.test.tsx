import assert from "node:assert/strict";
import test from "node:test";
import { cookieSession } from "../../src/auth/cookie-client";
import { renewCookieSession } from "../../src/auth/cookie-renewal";

const fixture = () => {
  const names = ["navigator", "document", "localStorage"] as const;
  const prior = names.map((name) =>
    Object.getOwnPropertyDescriptor(globalThis, name),
  );
  const fetch = globalThis.fetch;
  const data = new Map<string, string>();
  let fence = "a".repeat(43),
    queue = Promise.resolve();
  const storage = {
    get length() {
      return data.size;
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  const locks = {
    request: async (_name: string, run: () => Promise<void>) => {
      const previous = queue;
      let release = () => {};
      queue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await run();
      } finally {
        release();
      }
    },
  };
  for (const [name, value] of Object.entries({
    navigator: { locks },
    document: {
      get cookie() {
        return "__Host-romdex-generation=" + fence;
      },
    },
    localStorage: storage,
  }))
    Object.defineProperty(globalThis, name, { configurable: true, value });
  const challenge = {
    csrf: "c".repeat(43),
    renewalId: "r".repeat(43),
    renewUntil: Math.floor(Date.now() / 1000) + 1000,
  };
  const cleanup = () => {
    globalThis.fetch = fetch;
    names.forEach((name, i) => {
      const descriptor = prior[i];
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    });
  };
  return {
    data,
    storage,
    challenge,
    cleanup,
    change: () => {
      fence = "b".repeat(43);
    },
  };
};

test("renewal writes a durable attempt marker before POST and never retries a lost rotation", async () => {
  const f = fixture();
  let calls = 0;
  try {
    globalThis.fetch = async (_url, init) => {
      calls++;
      assert.equal(f.data.size, 1);
      assert.equal(init?.method, "POST");
      assert.equal(
        new Headers(init?.headers).get("x-romdex-csrf"),
        f.challenge.csrf,
      );
      throw Error("response lost");
    };
    for (let attempt = 0; attempt < 2; attempt++)
      await assert.rejects(
        renewCookieSession(
          "a".repeat(43),
          f.challenge,
          async () => false,
          () => {},
        ),
        /Sign in again/,
      );
    assert.equal(calls, 1);
    assert.deepEqual([...f.data.values()], [String(f.challenge.renewUntil)]);
  } finally {
    f.cleanup();
  }
});

test("unavailable durable storage or Web Locks refuses renewal before network", async () => {
  for (const unavailable of ["storage", "locks"]) {
    const f = fixture();
    let calls = 0;
    try {
      globalThis.fetch = async () => {
        calls++;
        return new Response();
      };
      if (unavailable === "storage")
        f.storage.setItem = () => {
          throw Error("blocked");
        };
      else
        Object.defineProperty(globalThis, "navigator", {
          configurable: true,
          value: {},
        });
      await assert.rejects(
        renewCookieSession(
          "a".repeat(43),
          f.challenge,
          async () => false,
          () => {},
        ),
        /Sign in again/,
      );
      assert.equal(calls, 0);
    } finally {
      f.cleanup();
    }
  }
});

test("two tabs serialize renewal and reread successful access instead of replaying refresh", async () => {
  const f = fixture();
  let valid = false,
    posts = 0;
  try {
    globalThis.fetch = async () => {
      posts++;
      valid = true;
      return Response.json({ renewed: true });
    };
    const run = () =>
      renewCookieSession(
        "a".repeat(43),
        f.challenge,
        async () => valid,
        () => {},
      );
    await Promise.all([run(), run()]);
    assert.equal(posts, 1);
    assert.equal(f.data.size, 1);
  } finally {
    f.cleanup();
  }
});

test("expired access renews only through challenge and fresh verified session read", async () => {
  const f = fixture();
  let valid = false,
    posts = 0;
  try {
    globalThis.fetch = async (url) => {
      if (String(url).endsWith("/renew")) {
        posts++;
        valid = true;
        return Response.json({ renewed: true });
      }
      return valid
        ? Response.json({
            userId: "owner",
            projects: [],
            csrf: "c".repeat(43),
            expiresAt: Date.now() / 1000 + 300,
          })
        : Response.json(
            {
              renewable: true,
              ...f.challenge,
              renewUntil: Math.floor(Date.now() / 1000) + 1000,
            },
            { status: 401 },
          );
    };
    const session = await cookieSession();
    assert.equal(session?.identity.id, "owner");
    assert.equal(posts, 1);
    assert.equal(session?.token, "romdex-cookie:" + "a".repeat(43));
    assert.equal(JSON.stringify([...f.data]).includes("accessToken"), false);
  } finally {
    f.cleanup();
  }
});

test("logout/account switch during renewal cannot restore the old account", async () => {
  const f = fixture();
  try {
    globalThis.fetch = async (url) => {
      if (String(url).endsWith("/renew")) {
        f.change();
        return Response.json({ renewed: true });
      }
      return Response.json(
        {
          renewable: true,
          ...f.challenge,
          renewUntil: Math.floor(Date.now() / 1000) + 1000,
        },
        { status: 401 },
      );
    };
    await assert.rejects(cookieSession(), /Authentication changed/);
  } finally {
    f.cleanup();
  }
});

test("plain expired/revoked session does not request renewal", async () => {
  const f = fixture();
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      return Response.json({}, { status: 401 });
    };
    assert.equal(await cookieSession(), null);
    assert.equal(calls, 1);
    assert.equal(f.data.size, 0);
  } finally {
    f.cleanup();
  }
});

test("renewal collects only conclusively expired markers and retains live and malformed markers", async () => {
  const f = fixture();
  const prefix = "romdex-renew-attempt-v1:";
  try {
    f.data.set(prefix + "expired", String(Math.floor(Date.now() / 1000) - 1));
    f.data.set(prefix + "live", String(f.challenge.renewUntil));
    f.data.set(prefix + "unknown", "attempted");
    f.data.set("draft", "keep");
    globalThis.fetch = async () => Response.json({ renewed: true });
    await renewCookieSession(
      "a".repeat(43),
      f.challenge,
      async () => false,
      () => {},
    );
    assert.equal(f.data.has(prefix + "expired"), false);
    assert.equal(f.data.get(prefix + "live"), String(f.challenge.renewUntil));
    assert.equal(f.data.get(prefix + "unknown"), "attempted");
    assert.equal(f.data.get("draft"), "keep");
    await assert.rejects(
      renewCookieSession(
        "a".repeat(43),
        f.challenge,
        async () => false,
        () => {},
      ),
      /Sign in again/,
    );
  } finally {
    f.cleanup();
  }
});

test("expired grant challenge is refused without deleting its marker or sending", async () => {
  const f = fixture();
  let posts = 0;
  try {
    const challenge = {
      ...f.challenge,
      renewUntil: Math.floor(Date.now() / 1000) - 1,
    };
    const key =
      "romdex-renew-attempt-v1:" + "a".repeat(43) + ":" + challenge.renewalId;
    f.data.set(key, String(challenge.renewUntil));
    globalThis.fetch = async () => {
      posts++;
      return new Response();
    };
    await assert.rejects(
      renewCookieSession(
        "a".repeat(43),
        challenge,
        async () => false,
        () => {},
      ),
      /Sign in again/,
    );
    assert.equal(posts, 0);
    assert.equal(f.data.get(key), String(challenge.renewUntil));
  } finally {
    f.cleanup();
  }
});

test("a requested persistent grant without refresh access reports ordinary expiry", async () => {
  const f = fixture();
  try {
    globalThis.fetch = async () =>
      Response.json({
        userId: "owner",
        projects: [],
        csrf: "c".repeat(43),
        expiresAt: Date.now() / 1000 + 300,
        rememberDeviceRequested: true,
        remembered: false,
      });
    assert.match((await cookieSession())?.notice ?? "", /expire normally/);
    assert.equal(f.data.size, 0);
  } finally {
    f.cleanup();
  }
});
