import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import Migration from "../../src/components/romdex/origin-migration";
test("completed origin migration exposes no administrator sign-in or write control", () => {
  const html = renderToStaticMarkup(<Migration />);
  assert.match(html, /https:\/\/romdex.vercel.app\//);
  assert.match(html, /administrator action has been removed/);
  assert.doesNotMatch(html, /<button|<input|Save this allowed origin/);
  assert.match(html, /not automatically transferred/);
});
