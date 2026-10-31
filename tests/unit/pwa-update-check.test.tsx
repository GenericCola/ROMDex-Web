import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { checkRegistrationUpdate } from "../../src/components/pwa-controls/check-update";
class Worker extends EventTarget {
  state: ServiceWorkerState = "installing";
  move(state: ServiceWorkerState) {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}
class Registration extends EventTarget {
  waiting: Worker | null = null;
  installing: Worker | null = null;
  calls = 0;
  action: () => Promise<void> = async () => {};
  update = async () => {
    this.calls++;
    await this.action();
  };
  asRegistration() {
    return this as unknown as ServiceWorkerRegistration;
  }
}
const run = (
  registration: Registration,
  controller = new AbortController(),
  online = true,
  timeout = 1000,
) => {
  const messages: string[] = [];
  const waiting: (ServiceWorker | null)[] = [];
  const work = checkRegistrationUpdate(
    async () => registration.asRegistration(),
    (value) => {
      messages.push(value);
    },
    (value) => {
      waiting.push(value);
    },
    controller.signal,
    () => online,
    timeout,
  );
  return { work, messages, waiting };
};
const tick = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};
test("forces update and remains pending until the real registration update resolves", async () => {
  const reg = new Registration();
  let release = () => {};
  reg.action = () =>
    new Promise<void>((resolve) => {
      release = resolve;
    });
  const check = run(reg);
  let done = false;
  void check.work.then(() => {
    done = true;
  });
  await tick();
  assert.equal(reg.calls, 1);
  assert.equal(done, false);
  assert.match(check.messages[0] ?? "", /Checking/);
  release();
  await check.work;
  assert.equal(done, true);
  assert.match(check.messages.at(-1) ?? "", /latest ROMDex app version/);
  assert.equal(check.waiting.at(-1), null);
});
test("waits for actual installation, then exposes waiting worker without activating it", async () => {
  const reg = new Registration(),
    worker = new Worker();
  reg.action = async () => {
    reg.installing = worker;
    reg.dispatchEvent(new Event("updatefound"));
  };
  const check = run(reg);
  let done = false;
  void check.work.then(() => {
    done = true;
  });
  await tick();
  assert.equal(done, false);
  assert.match(check.messages.at(-1) ?? "", /Downloading/);
  reg.waiting = worker;
  reg.installing = null;
  worker.move("installed");
  await check.work;
  assert.equal(check.waiting.at(-1), worker);
  assert.match(check.messages.at(-1) ?? "", /Update ready/);
});
test("already waiting still forces a check, no updatefound leaves app up to date, first install completes", async () => {
  const reg = new Registration(),
    worker = new Worker();
  worker.state = "installed";
  reg.waiting = worker;
  const check = run(reg);
  await check.work;
  assert.equal(reg.calls, 1);
  assert.equal(check.waiting[0], worker);
  const first = new Registration(),
    install = new Worker();
  first.installing = install;
  const initial = run(first);
  await tick();
  first.installing = null;
  install.move("activated");
  await initial.work;
  assert.match(initial.messages.at(-1) ?? "", /latest ROMDex app version/);
});
test("offline, network failure, failed installation and missing registration are honest errors", async () => {
  const offline = new Registration();
  await assert.rejects(
    run(offline, new AbortController(), false).work,
    /offline/,
  );
  assert.equal(offline.calls, 0);
  const failed = new Registration();
  failed.action = async () => {
    throw Error("Synthetic update failure");
  };
  await assert.rejects(run(failed).work, /Synthetic update failure/);
  const reg = new Registration(),
    worker = new Worker();
  reg.installing = worker;
  const check = run(reg);
  await tick();
  worker.move("redundant");
  await assert.rejects(check.work, /could not finish installing/);
  await assert.rejects(
    checkRegistrationUpdate(
      async () => undefined,
      () => {},
      () => {},
      new AbortController().signal,
      () => true,
    ),
    /not ready/,
  );
});
test("timeout and cancellation release pending check and ignore late completion/events", async () => {
  const reg = new Registration();
  let release = () => {};
  reg.action = () =>
    new Promise<void>((resolve) => {
      release = resolve;
    });
  const check = run(reg, new AbortController(), true, 5);
  await assert.rejects(check.work, /did not finish/);
  const length = check.messages.length;
  release();
  await tick();
  assert.equal(check.messages.length, length);
  const cancelled = new Registration(),
    worker = new Worker();
  cancelled.installing = worker;
  const controller = new AbortController();
  const other = run(cancelled, controller);
  await tick();
  controller.abort();
  await assert.rejects(other.work, /cancelled/);
  const messages = other.messages.length;
  worker.move("installed");
  assert.equal(other.messages.length, messages);
});
test("check helper never activates; usePwa defaults activation to workspace safety guard", async () => {
  const source = await readFile(
    new URL(
      "../../src/components/pwa-controls/check-update.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /postMessage|ACTIVATE_UPDATE|location\.reload|skipWaiting/,
  );
  const hook = await readFile(
    new URL("../../src/components/pwa-controls/use-pwa.ts", import.meta.url),
    "utf8",
  );
  assert.match(hook, /workspaceStore\.prepareUpdate/);
  assert.match(hook, /requestUpdate\(waiting, beforeUpdate, setMessage\)/);
});
