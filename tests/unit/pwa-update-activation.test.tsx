import assert from "node:assert/strict";
import { test } from "node:test";
import { requestUpdate } from "../../src/components/pwa-controls/request-update";
import { createUpdateActivation } from "../../src/components/pwa-controls/update-activation";
const harness = () => {
  const originals = new Map(
    ["window", "navigator", "MessageChannel"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const serviceWorker = new EventTarget();
  let reloads = 0,
    timeout: () => void = () => {},
    releases = 0,
    posts = 0,
    guarded = 0;
  const channels: Channel[] = [];
  class Channel {
    port1 = {
      onmessage: null as
        ((event: { data: { blocked: boolean } }) => void) | null,
      close: () => {},
    };
    port2 = { close: () => {} };
    constructor() {
      channels.push(this);
    }
  }
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      setTimeout: (callback: () => void) => {
        timeout = callback;
        return 1;
      },
      clearTimeout: () => {},
      location: {
        reload: () => {
          reloads++;
        },
      },
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { serviceWorker },
  });
  Object.defineProperty(globalThis, "MessageChannel", {
    configurable: true,
    value: Channel,
  });
  const waiting = {
    postMessage: () => {
      posts++;
    },
  } as unknown as ServiceWorker;
  const guard = async () => {
    guarded++;
    return () => {
      releases++;
    };
  };
  const clean = () => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  };
  return {
    waiting,
    guard,
    serviceWorker,
    channels,
    clean,
    timeout: () => timeout(),
    counts: () => ({ reloads, releases, posts, guarded }),
  };
};
const tick = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};
test("repeated activation calls are single-flight through blocked response and allow a safe retry", async () => {
  const h = harness(),
    busy: boolean[] = [],
    messages: string[] = [];
  try {
    const activation = createUpdateActivation((value) => {
      busy.push(value);
    });
    const action = () =>
      requestUpdate(h.waiting, h.guard, (value) => {
        messages.push(value);
      });
    const first = activation.run(action),
      second = activation.run(action);
    assert.equal(first, second);
    await tick();
    assert.deepEqual(h.counts(), {
      posts: 1,
      guarded: 1,
      releases: 0,
      reloads: 0,
    });
    assert.equal(activation.busy(), true);
    h.channels[0]?.port1.onmessage?.({ data: { blocked: true } });
    await first;
    assert.deepEqual(busy, [true, false]);
    assert.match(messages[0] ?? "", /Close other/);
    assert.equal(h.counts().releases, 1);
    const retry = activation.run(action);
    await tick();
    h.serviceWorker.dispatchEvent(new Event("controllerchange"));
    await retry;
    assert.deepEqual(h.counts(), {
      posts: 2,
      guarded: 2,
      releases: 2,
      reloads: 1,
    });
    assert.equal(activation.busy(), false);
  } finally {
    h.clean();
  }
});
test("dirty/in-flight safety guard refuses before any activation message or reload", async () => {
  const h = harness();
  try {
    const activation = createUpdateActivation(() => {});
    await assert.rejects(
      activation.run(() =>
        requestUpdate(
          h.waiting,
          async () => {
            throw Error("Unsaved draft or delivery in flight");
          },
          () => {},
        ),
      ),
      /Unsaved draft/,
    );
    assert.equal(h.counts().posts, 0);
    assert.equal(h.counts().reloads, 0);
    assert.equal(activation.busy(), false);
  } finally {
    h.clean();
  }
});
test("activation timeout releases lock, removes controller listener and ignores late messages", async () => {
  const h = harness(),
    messages: string[] = [];
  try {
    const work = requestUpdate(h.waiting, h.guard, (value) => {
      messages.push(value);
    });
    await tick();
    h.timeout();
    await work;
    h.serviceWorker.dispatchEvent(new Event("controllerchange"));
    h.channels[0]?.port1.onmessage?.({ data: { blocked: false } });
    assert.equal(h.counts().releases, 1);
    assert.equal(h.counts().reloads, 0);
    assert.equal(messages.length, 1);
    assert.match(messages[0] ?? "", /did not finish/);
  } finally {
    h.clean();
  }
});
test("postMessage failure releases the workspace guard and can be retried", async () => {
  const h = harness();
  try {
    const broken = {
      postMessage: () => {
        throw Error("Synthetic post failure");
      },
    } as unknown as ServiceWorker;
    await assert.rejects(
      requestUpdate(broken, h.guard, () => {}),
      /post failure/,
    );
    assert.equal(h.counts().releases, 1);
    assert.equal(h.counts().reloads, 0);
  } finally {
    h.clean();
  }
});
