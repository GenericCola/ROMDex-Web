import assert from "node:assert/strict";
import test from "node:test";
import { OAUTH_ORIGIN } from "../../src/auth/origins";
import { startResume } from "../../src/components/romdex/start-auth-resume";
import { YOUTRACK_ORIGIN } from "../../src/youtrack/read-tasks";
test(
  "storage failure during retry reread stays signed out and settles feedback",
  { timeout: 2000 },
  async () => {
    const prior = Object.getOwnPropertyDescriptor(globalThis, "window"),
      fetch = globalThis.fetch;
    let reads = 0,
      message = "",
      retry = true,
      identity: unknown = null;
    const record = {
      version: 1,
      instance: YOUTRACK_ORIGIN,
      token: "synthetic",
      expiresAt: Date.now() + 60000,
      userId: "1-98765",
      projectId: null,
    };
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: { origin: OAUTH_ORIGIN },
        sessionStorage: {
          getItem: () => {
            if (++reads > 1) throw Error("Storage unavailable");
            return JSON.stringify(record);
          },
          removeItem: () => {},
          setItem: () => {},
        },
      },
    });
    globalThis.fetch = async () => {
      throw new TypeError("Synthetic offline");
    };
    let done = () => {};
    const settled = new Promise<void>((resolve) => {
      done = resolve;
    });
    try {
      const cleanup = startResume({
        sessionRef: { current: null },
        generationRef: { current: 0 },
        setBusy: (value) => {
          if (!value) done();
        },
        setMessage: (value) => {
          message = value;
        },
        setRetryable: (value) => {
          retry = value;
        },
        setIdentity: (value) => {
          identity = value;
        },
        setSelected: () => {},
        setIssues: () => {},
      });
      await settled;
      assert.equal(identity, null);
      assert.equal(retry, false);
      assert.match(message, /Could not resume/);
      cleanup();
    } finally {
      globalThis.fetch = fetch;
      if (prior) Object.defineProperty(globalThis, "window", prior);
      else Reflect.deleteProperty(globalThis, "window");
    }
  },
);

test("recovery-blocked gate disables signed-out sign-in and retry controls", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { default: AuthSignInSection } =
    await import("../../src/components/romdex/auth-sign-in-section");
  const { readFileSync } = await import("node:fs");
  const html = renderToStaticMarkup(
    <AuthSignInSection
      busy={true}
      retryable={true}
      retryResume={() => {}}
      signIn={async () => {}}
    />,
  );
  assert.match(html, /<button[^>]*disabled=""[^>]*>Retry sign-in verification/);
  const gate = readFileSync("src/components/romdex/auth-gate.tsx", "utf8");
  assert.match(gate, /<AuthSignInSection\s+busy=\{busy \|\| recoveryBlocked\}/);
  const hook = readFileSync(
    "src/components/romdex/use-auth-workspace.ts",
    "utf8",
  );
  assert.match(
    hook,
    /const signIn = async \(\) => \{\s*if \(recoveryBlocked\) return/,
  );
  assert.match(hook, /if \(!recoveryBlocked && !busy\) resume/);
});
