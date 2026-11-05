import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import AuthGate from "../../src/components/romdex/auth-gate";
test("initial gate shows a stable opening screen without sign-in controls or cached workspace", () => {
  const html = renderToStaticMarkup(<AuthGate />);
  assert.match(html, /romdex-app auth-shell/);
  assert.match(html, /device-header/);
  assert.match(html, /auth-card suite-tray port-form/);
  assert.match(html, /Opening ROMDex/);
  assert.match(html, /Checking sign-in and opening your workspace/);
  assert.doesNotMatch(
    html,
    /Sign in with YouTrack|type="checkbox"|Choose your project/,
  );
  assert.doesNotMatch(html, /id="work-tray"|type="password"|Your Project/);
});
