import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import DeliveryFeedback from "../../src/components/romdex/delivery-feedback";
test("review feedback is announced and stays after review actions", () => {
  const html = renderToStaticMarkup(
    <DeliveryFeedback message="Reconnect delivery before reviewing" />,
  );
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /Reconnect delivery/);
  const source = readFileSync(
    new URL(
      "../../src/components/romdex/delivery-controls.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(
    source.indexOf("<DeliveryFeedback") >
      source.indexOf("{records.map(render)}"),
  );
  const css = readFileSync(
    new URL("../../src/styles/romdex-desktop.css", import.meta.url),
    "utf8",
  );
  assert.match(css, /\.deletion-review-confirmation\s*\{[^}]*gap:\s*\.5rem/s);
});
