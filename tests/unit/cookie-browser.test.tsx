import assert from "node:assert/strict";
import test from "node:test";
import {
  cookieFetch,
  cookieGeneration,
  cookieSession,
  endCookieLogin,
} from "../../src/auth/cookie-client";
import { authRequestGuard, setAuthSession } from "../../src/auth/session";
import { AttachmentClient } from "../../src/youtrack/attachment-client";
const fence = "a".repeat(43);
const install = () => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, "document");
  const original = globalThis.fetch;
  let cookie = "__Host-romdex-generation=" + fence;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      get cookie() {
        return cookie;
      },
      set cookie(value: string) {
        cookie = value.split(";")[0] ?? "";
      },
    },
  });
  return () => {
    globalThis.fetch = original;
    setAuthSession(null);
    if (prior) Object.defineProperty(globalThis, "document", prior);
    else Reflect.deleteProperty(globalThis, "document");
  };
};
test("cookie session has no bearer token and converts server seconds to UI milliseconds", async () => {
  const cleanup = install();
  try {
    const expiry = Math.floor(Date.now() / 1000) + 300;
    globalThis.fetch = async () =>
      Response.json({
        userId: "1-a",
        projects: [],
        csrf: "csrf",
        expiresAt: expiry,
      });
    const result = await cookieSession();
    assert.equal(result?.token, "romdex-cookie:" + fence);
    assert.equal(result?.expiresAt, expiry * 1000);
    assert.equal(result?.identity.id, "1-a");
  } finally {
    cleanup();
  }
});
test("generation change while session response body resolves cannot restore previous identity", async () => {
  const cleanup = install();
  try {
    globalThis.fetch = async () =>
      ({
        status: 200,
        ok: true,
        json: async () => {
          cookieGeneration().rotate();
          return {
            userId: "old",
            projects: [],
            csrf: "csrf",
            expiresAt: Date.now() / 1000 + 300,
          };
        },
      }) as Response;
    await assert.rejects(cookieSession(), /Authentication changed/);
  } finally {
    cleanup();
  }
});
test("cross-tab generation blocks dispatch synchronously and late replies", async () => {
  const cleanup = install();
  try {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      cookieGeneration().rotate();
      return Response.json({});
    };
    await assert.rejects(
      cookieFetch("romdex-cookie:" + fence, "/api/youtrack?route=users%2Fme"),
      /Authentication changed/,
    );
    assert.equal(calls, 1);
    await assert.rejects(
      cookieFetch("romdex-cookie:" + fence, "/api/youtrack?route=users%2Fme"),
      /Authentication changed/,
    );
    assert.equal(calls, 1);
    assert.throws(
      authRequestGuard("romdex-cookie:" + fence),
      /Authentication changed/,
    );
  } finally {
    cleanup();
  }
});
test("logout rotation takes effect even when logout request fails", async () => {
  const cleanup = install();
  try {
    globalThis.fetch = async () => {
      throw Error("offline");
    };
    await endCookieLogin();
    assert.notEqual(cookieGeneration().current(), fence);
  } finally {
    cleanup();
  }
});
test("large new cookie upload is refused before request, while direct upload limit remains unchanged", async () => {
  let requests = 0;
  const request = async () => {
    requests++;
    return [];
  };
  const files = new AttachmentClient(request, "romdex-cookie:" + fence);
  assert.throws(
    () => files.requireUploadSize(4_000_001),
    /queued bytes.*preserved/,
  );
  files.requireUploadSize(4_000_000);
  const direct = new AttachmentClient(request, "synthetic-direct-token");
  direct.requireUploadSize(5_000_000);
  assert.equal(requests, 0);
});

test("server resume failure settles busy and offers retry without clearing account data", async () => {
  const cleanup = install();
  try {
    const { startCookieResume } =
      await import("../../src/components/romdex/start-cookie-resume");
    globalThis.fetch = async () => {
      throw Error("Synthetic offline");
    };
    let finish = () => {};
    const done = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let retry = false,
      message = "",
      identity: unknown = null;
    const stop = startCookieResume({
      sessionRef: { current: null },
      generationRef: { current: 0 },
      setBusy(value) {
        if (!value) finish();
      },
      setMessage(value) {
        message = value;
      },
      setIdentity(value) {
        identity = value;
      },
      setSelected() {},
      setIssues() {},
      setRetryable(value) {
        retry = value;
      },
    });
    await done;
    assert.equal(retry, true);
    assert.match(message, /offline/);
    assert.equal(identity, null);
    stop();
  } finally {
    cleanup();
  }
});
test("cleaned-up resume cannot restore identity when a delayed session response arrives", async () => {
  const cleanup = install();
  try {
    const { startCookieResume } =
      await import("../../src/components/romdex/start-cookie-resume");
    let release = (_value: Response) => {};
    globalThis.fetch = () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      });
    let identity: unknown = null;
    const sessionRef = { current: null };
    const stop = startCookieResume({
      sessionRef,
      generationRef: { current: 0 },
      setBusy() {},
      setMessage() {},
      setIdentity(value) {
        identity = value;
      },
      setSelected() {},
      setIssues() {},
      setRetryable() {},
    });
    stop();
    release(
      Response.json({
        userId: "old",
        projects: [],
        csrf: "csrf",
        expiresAt: Date.now() / 1000 + 300,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(identity, null);
    assert.equal(sessionRef.current, null);
  } finally {
    cleanup();
  }
});
