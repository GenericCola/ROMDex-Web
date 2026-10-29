import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import AuthGate from "../../src/components/romdex/auth-gate";
test("signed-out gate uses accepted device shell and contains no cached workspace or token field", () => {
  const html = renderToStaticMarkup(<AuthGate />);
  assert.match(html, /romdex-app auth-shell/);
  assert.match(html, /device-header/);
  assert.match(html, /auth-card suite-tray port-form/);
  assert.match(html, /class="primary"/);
  assert.match(html, /Sign in with YouTrack/);
  assert.match(html, /href="https:\/\/romdex.vercel.app\/"/);
  assert.match(html, /not automatically transferred/);
  assert.doesNotMatch(html, /id="work-tray"|type="password"|Your Project/);
});
