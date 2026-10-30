import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import Dialog from "../../src/components/romdex/dialog";
import { SessionRecoveryContext } from "../../src/components/romdex/session-recovery-context";
const close = () => {
  return undefined;
};
void test("active modal retains draft and shows expired-session recovery instructions inside dialog", () => {
  const html = renderToStaticMarkup(
    <SessionRecoveryContext value={true}>
      <Dialog title="Tile Settings" close={close}>
        <input aria-label="Name" defaultValue="Unapplied local name" />
        <button>Apply Tile Changes</button>
      </Dialog>
    </SessionRecoveryContext>,
  );
  assert.match(html, /<dialog[^>]*>[\s\S]*role="alert"[\s\S]*<\/dialog>/);
  assert.match(html, /Remote access is disconnected/);
  assert.match(html, /Account switching remains blocked/);
  assert.match(html, /value="Unapplied local name"/);
  assert.match(html, /Apply Tile Changes/);
});
void test("ordinary and mounted-closed dialogs have no spurious session notice", () => {
  for (const open of [true, false]) {
    const html = renderToStaticMarkup(
      <Dialog title="Workspace tools" close={close} open={open}>
        <button>Export Recovery Copy</button>
      </Dialog>,
    );
    assert.doesNotMatch(html, /session expired|role="alert"/);
    assert.match(html, /Export Recovery Copy/);
  }
});
void test("busy modal exposes a disabled close button without dropping draft children", () => {
  const html = renderToStaticMarkup(
    <Dialog title="Tile Settings" close={close} canClose={false}>
      <input defaultValue="Preserved draft" />
    </Dialog>,
  );
  assert.match(html, /aria-label="Close Tile Settings" disabled=""/);
  assert.match(html, /value="Preserved draft"/);
});
