import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  delayedFlagStep,
  loaderShown,
} from "../../src/components/romdex/delayed-flag-step";
import Pending from "../../src/components/romdex/pending";
const DELAY = 250,
  MINIMUM = 400;
/** Plays a busy period of `work` ms through the pure step and reports when the flag shows and hides. */
const play = (work: number) => {
  const on = delayedFlagStep(true, false, 0, DELAY, MINIMUM);
  const showsAt = on.wait ?? 0;
  if (work < showsAt) return { shows: false, showsAt, hidesAt: 0 };
  const off = delayedFlagStep(false, true, work - showsAt, DELAY, MINIMUM);
  return { shows: true, showsAt, hidesAt: work + (off.wait ?? 0) };
};
test("a fast finish never shows a loader", () => {
  for (const work of [0, 1, 100, 249]) assert.equal(play(work).shows, false);
  assert.deepEqual(delayedFlagStep(false, false, 100, DELAY, MINIMUM), {
    next: false,
    wait: null,
  });
});
test("slow work shows only after the delay", () => {
  assert.deepEqual(delayedFlagStep(true, false, 0, DELAY, MINIMUM), {
    next: true,
    wait: DELAY,
  });
  assert.equal(delayedFlagStep(true, false, 100, DELAY, MINIMUM).wait, 150);
  assert.equal(delayedFlagStep(true, false, 900, DELAY, MINIMUM).wait, 0);
  assert.equal(play(250).shows, true);
  assert.equal(play(250).showsAt, DELAY);
});
test("once shown, the loader stays for the minimum", () => {
  const brief = play(300);
  assert.equal(brief.hidesAt - brief.showsAt, MINIMUM);
  const long = play(2000);
  assert.equal(long.hidesAt, 2000);
  assert.deepEqual(delayedFlagStep(true, true, 10_000, DELAY, MINIMUM), {
    next: true,
    wait: null,
  });
  assert.deepEqual(delayedFlagStep(false, true, 100, DELAY, MINIMUM), {
    next: false,
    wait: 300,
  });
  assert.equal(delayedFlagStep(false, true, 400, DELAY, MINIMUM).wait, 0);
});
test("delay and minimum are configurable", () => {
  assert.equal(delayedFlagStep(true, false, 0, 50, 10).wait, 50);
  assert.equal(delayedFlagStep(false, true, 0, 50, 10).wait, 10);
});
test("Pending renders the same reserved status line in both states", () => {
  const idle = renderToStaticMarkup(
    <Pending active={false} label="Reading…" message="Done" />,
  );
  const fresh = renderToStaticMarkup(
    <Pending active label="Reading…" message="Done" />,
  );
  for (const html of [idle, fresh]) {
    assert.match(html, /^<p class="romdex-pending" role="status"/);
    assert.match(html, /aria-live="polite"/);
  }
  assert.match(idle, />Done<\/p>$/);
  assert.doesNotMatch(idle, /romdex-spinner|aria-busy/);
  assert.doesNotMatch(fresh, /romdex-spinner|aria-busy/);
});
test("Pending with no message is an empty reserved line and keeps className", () => {
  const html = renderToStaticMarkup(
    <Pending active={false} label="Reading…" className="small" />,
  );
  assert.equal(
    html,
    '<p class="romdex-pending small" role="status" aria-live="polite"></p>',
  );
});

test("a finished result message replaces a held loader at once", () => {
  assert.equal(loaderShown(true, true, "Done"), true);
  assert.equal(loaderShown(true, false, undefined), true);
  assert.equal(loaderShown(true, false, ""), true);
  assert.equal(loaderShown(true, false, "Done"), false);
  assert.equal(loaderShown(false, true, undefined), false);
});
