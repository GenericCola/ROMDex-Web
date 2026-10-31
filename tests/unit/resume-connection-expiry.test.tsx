import assert from "node:assert/strict";
import { test } from "node:test";
import { OAUTH_ORIGIN } from "../../src/auth/origins";
import { startResume } from "../../src/components/romdex/start-auth-resume";
import { YOUTRACK_ORIGIN } from "../../src/youtrack/read-tasks";
test("resume crossing original expiry during data connection publishes no identity or project", async (t) => {
  const before = Object.getOwnPropertyDescriptor(globalThis, "window");
  let now = 1000;
  t.mock.method(Date, "now", () => now);
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { origin: OAUTH_ORIGIN }, sessionStorage: {} },
  });
  let identity: unknown = null,
    selected: unknown = null,
    release!: () => void,
    started!: () => void,
    done!: () => void;
  const waiting = new Promise<void>((resolve) => {
      release = resolve;
    }),
    began = new Promise<void>((resolve) => {
      started = resolve;
    }),
    settled = new Promise<void>((resolve) => {
      done = resolve;
    });
  const project = { id: "0-1", shortName: "PMON", name: "Synthetic" };
  const restore: typeof import("../../src/auth/restore-session").restoreSession =
    async () => ({
      record: {
        version: 1 as const,
        instance: YOUTRACK_ORIGIN,
        token: "synthetic",
        expiresAt: 2000,
        userId: "1-1",
        projectId: project.id,
      },
      identity: { id: "1-1", name: "Synthetic", projects: [project] },
      project,
      issues: [],
    });
  let cleanup = () => {};
  try {
    cleanup = startResume(
      {
        sessionRef: { current: null },
        generationRef: { current: 0 },
        setBusy: (v) => {
          if (!v) done();
        },
        setMessage: () => {},
        setIdentity: (v) => {
          identity = v;
        },
        setSelected: (v) => {
          selected = v;
        },
        setIssues: () => {},
        setRetryable: () => {},
      },
      restore,
      async () => {
        started();
        await waiting;
        return "";
      },
    );
    await began;
    now = 2001;
    release();
    await settled;
    assert.equal(identity, null);
    assert.equal(selected, null);
  } finally {
    release();
    cleanup();
    if (before) Object.defineProperty(globalThis, "window", before);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("final connection401/403 rejects resumed workspace and clears valid tab record", async () => {
  const { connectProject } = await import("../../src/auth/connect-project");
  const { YouTrackHttpError } = await import("../../src/youtrack/http-error");
  const { hasAuthSession } = await import("../../src/auth/session");
  const before = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    for (const status of [401, 403]) {
      let saved = "existing",
        identity: unknown = null,
        selected: unknown = null,
        done!: () => void;
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          location: { origin: OAUTH_ORIGIN },
          sessionStorage: {
            removeItem: () => {
              saved = "";
            },
          },
        },
      });
      const settled = new Promise<void>((resolve) => {
        done = resolve;
      });
      const project = { id: "0-1", shortName: "PMON", name: "Synthetic" };
      const refs = {
        current: null as null | { token: string; expiresAt: number },
      };
      const cleanup = startResume(
        {
          sessionRef: refs,
          generationRef: { current: 0 },
          setBusy: (v) => {
            if (!v) done();
          },
          setMessage: () => {},
          setIdentity: (v) => {
            identity = v;
          },
          setSelected: (v) => {
            selected = v;
          },
          setIssues: () => {},
          setRetryable: () => {},
        },
        async () => ({
          record: {
            version: 1,
            instance: YOUTRACK_ORIGIN,
            token: "synthetic",
            expiresAt: Date.now() + 60000,
            userId: "1-1",
            projectId: project.id,
          },
          identity: { id: "1-1", name: "Synthetic", projects: [project] },
          project,
          issues: [],
        }),
        async (token, p, check) =>
          connectProject(token, p, check, async () => {
            throw new YouTrackHttpError(status);
          }),
      );
      await settled;
      assert.equal(saved, "");
      assert.equal(identity, null);
      assert.equal(selected, null);
      assert.equal(refs.current, null);
      assert.equal(hasAuthSession(), false);
      cleanup();
    }
  } finally {
    if (before) Object.defineProperty(globalThis, "window", before);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
