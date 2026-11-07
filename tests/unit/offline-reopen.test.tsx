import assert from "node:assert/strict";
import test from "node:test";
import {
  forgetOfflineAccount,
  offlineAccount,
  rememberOfflineAccount,
} from "../../src/auth/offline-account";
import { cookieSignOut } from "../../src/components/romdex/cookie-sign-out";
import { startCookieResume } from "../../src/components/romdex/start-cookie-resume";
import { memoryStorage } from "../fixtures/memory-storage";

const pmon = { id: "0-1", shortName: "PMON", name: "Synthetic PMON" };
const withBrowser = async (run: (storage: Map<string, string>) => unknown) => {
  const names = ["document", "window", "localStorage"] as const;
  const descriptors = names.map((name) => {
    return Object.getOwnPropertyDescriptor(globalThis, name);
  });
  const fetch = globalThis.fetch;
  const storage = memoryStorage();
  for (const [name, value] of Object.entries({
    document: { cookie: "__Host-romdex-generation=" + "a".repeat(43) },
    window: {
      location: { origin: "https://romdex.vercel.app" },
      sessionStorage: storage,
    },
    localStorage: storage,
  }))
    Object.defineProperty(globalThis, name, { configurable: true, value });
  try {
    await run(storage.values);
  } finally {
    globalThis.fetch = fetch;
    names.forEach((name, i) => {
      const descriptor = descriptors[i];
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
};
const resumeWith = async (reply: () => Promise<Response>) => {
  globalThis.fetch = reply;
  const offline: string[] = [];
  const messages: string[] = [];
  let finish = () => {};
  const done = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const stop = startCookieResume({
    sessionRef: { current: null },
    generationRef: { current: 0 },
    setBusy: (value) => {
      if (!value) finish();
    },
    setMessage: (value) => {
      messages.push(value);
    },
    setIdentity: () => {},
    setSelected: () => {},
    setIssues: () => {},
    setRetryable: () => {},
    openOffline: async (isCurrent) => {
      offline.push(String(isCurrent()));
      return offlineAccount() !== null;
    },
  });
  await done;
  stop();
  return { offline, messages };
};

test("the remembered offline account keeps ids and names only, and only for PMON", async () => {
  await withBrowser((values) => {
    rememberOfflineAccount("fixture-owner", {
      id: "0-2",
      shortName: "OTHER",
      name: "Other",
    });
    assert.equal(offlineAccount(), null);
    rememberOfflineAccount("fixture-owner", { ...pmon, token: "x" } as never);
    assert.deepEqual(offlineAccount(), { userId: "fixture-owner", project: pmon });
    assert.doesNotMatch([...values.values()].join(), /token/);
    forgetOfflineAccount();
    assert.equal(offlineAccount(), null);
  });
});

test("a network failure opens saved work offline, a 401 never does", async () => {
  await withBrowser(async () => {
    rememberOfflineAccount("fixture-owner", pmon);
    const down = await resumeWith(() => {
      return Promise.reject(new TypeError("Failed to fetch"));
    });
    assert.deepEqual(down.offline, ["true"]);
    assert.equal(down.messages.some((text) => /Failed/.test(text)), false);
    const refused = await resumeWith(async () => {
      return new Response(null, { status: 401 });
    });
    assert.deepEqual(refused.offline, []);
    forgetOfflineAccount();
    const unknown = await resumeWith(() => {
      return Promise.reject(new TypeError("Failed to fetch"));
    });
    assert.deepEqual(unknown.offline, ["true"]);
    assert.match(unknown.messages.at(-1) ?? "", /Failed to fetch/);
  });
});

test("sign-out forgets the offline account", async () => {
  await withBrowser(async () => {
    globalThis.fetch = async () => new Response();
    rememberOfflineAccount("fixture-owner", pmon);
    await cookieSignOut(
      async () => {},
      () => {},
      () => {},
      () => {},
    );
    assert.equal(offlineAccount(), null);
  });
});
