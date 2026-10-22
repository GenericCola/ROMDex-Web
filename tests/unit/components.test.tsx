import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import IconButton from "../../src/components/icon-button/index";
import Panel from "../../src/components/panel/index";
import StatusIndicator from "../../src/components/status-indicator/index";
import TextField from "../../src/components/text-field/index";
test("icon button exposes its name and preserves native disabled behavior", () => {
  const html = renderToStaticMarkup(
    <IconButton label="Reset" disabled>
      R
    </IconButton>,
  );
  assert.match(html, /aria-label="Reset"/);
  assert.match(html, /disabled=""/);
  assert.match(html, /type="button"/);
});
test("panel preserves region label", () =>
  assert.match(
    renderToStaticMarkup(<Panel aria-label="Tools">Tools</Panel>),
    /aria-label="Tools"/,
  ));
test("field connects label, error and existing description", () => {
  const html = renderToStaticMarkup(
    <TextField
      id="name"
      label="Name"
      error="Required"
      aria-describedby="help"
    />,
  );
  assert.match(html, /for="name"/);
  assert.match(html, /aria-describedby="help name-error"/);
  assert.match(html, /aria-invalid="true"/);
});
test("status exposes a live region", () =>
  assert.match(
    renderToStaticMarkup(<StatusIndicator label="Ready" />),
    /role="status"/,
  ));
