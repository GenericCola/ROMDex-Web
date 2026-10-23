const host = await YTApp.register();
const output = document.getElementById("result");
const buttons = [...document.querySelectorAll("button")];
const log = (text) => {
  output.textContent += text + "\n";
};
const assert = (condition, message) => {
  if (!condition) throw Error(message);
  log("PASS " + message);
};
const base = ({ revision, initialized, assignedState, state, updated }) => ({
  revision,
  initialized,
  assignedState,
  state,
  updated,
});
const read = () => host.fetchApp("status/assigned", { scope: true });
const write = (body) =>
  host.fetchApp("status/assigned", { scope: true, method: "POST", body });
const request = (snapshot, kind, value) => ({
  schema: 1,
  opId: crypto.randomUUID(),
  kind,
  value,
  expected: base(snapshot),
});
const safeRead = async () => {
  const value = await read();
  assert(
    ["NPCD-872", "NPCD-873"].includes(value.id) && value.schema === 1,
    "allowlisted live fixture and protocol",
  );
  return value;
};
const rejected = async (body) => {
  try {
    await write(body);
  } catch (error) {
    const code = error.status ?? error.statusCode ?? error.response?.status;
    assert(
      code === 409,
      "stale or reused request rejected with HTTP 409 (received " + code + ")",
    );
    return;
  }
  throw Error("Rejected request was accepted");
};
const run = async () => {
  const capability = await host.fetchApp("capabilities/check", { scope: false });
  assert(
    capability.app === "romdex-status-acceptance" &&
      capability.project === "NPCD" &&
      capability.schema === 1 &&
      capability.statusRules === 4,
    "test app identity, protocol and status rules 4",
  );
  let before = await safeRead();
  const assignment = request(before, "assign", "In Progress");
  await write(assignment);
  let current = await safeRead();
  assert(
    current.revision === before.revision + 1 &&
      current.assignedState === "In Progress" &&
      current.state === before.state,
    "assignment stored separately from native State",
  );
  assert(
    JSON.stringify(current.receipt) === JSON.stringify(assignment),
    "exact receipt survives a fresh request",
  );
  await write(assignment);
  let replay = await read();
  assert(
    JSON.stringify(replay) === JSON.stringify(current),
    "exact replay performs no write",
  );
  await rejected({ ...assignment, value: "Open" });
  const effective = request(
    current,
    "rollup",
    current.id === "NPCD-872" ? "Done" : "In Progress",
  );
  await write(effective);
  current = await read();
  assert(
    current.assignedState === "In Progress" &&
      current.state === effective.value &&
      current.receipt.opId === effective.opId,
    "server rollup preserves own assignment",
  );
  await rejected(request(before, "assign", "Open"));
  const a = request(current, "assign", "Open"),
    b = request(current, "assign", "In Progress");
  const results = await Promise.allSettled([write(a), write(b)]);
  log(
    "Concurrent results: " +
      JSON.stringify(
        results.map((r) => ({
          status: r.status,
          code:
            r.reason?.status ??
            r.reason?.statusCode ??
            r.reason?.response?.status,
        })),
      ),
  );
  const successes = results.filter((r) => r.status === "fulfilled");
  const final = await read();
  assert(
    successes.length === 1 &&
      final.revision === current.revision + 1 &&
      [a.opId, b.opId].includes(final.receipt.opId),
    "same-revision concurrent requests admit exactly one writer",
  );
  log("FINAL " + JSON.stringify(final));
  log(
    "Complete. Reload this issue or open it in another tab, then Read live metadata to verify persistence.",
  );
};
const rollback = async () => {
  const before = await safeRead();
  assert(
    before.initialized && before.state !== "Open",
    "rollback starts with initialized metadata and a non-Open native State",
  );
  let failure;
  try {
    await host.fetchApp("fault/rollback", {
      scope: true,
      method: "POST",
      body: {},
    });
  } catch (error) {
    failure = error;
  }
  const after = await read();
  assert(
    JSON.stringify(after) === JSON.stringify(before),
    "failed request left metadata, State and timestamp unchanged",
  );
  const code =
    failure?.status ?? failure?.statusCode ?? failure?.response?.status;
  const detail =
    String(failure?.message ?? "") + " " + JSON.stringify(failure ?? {});
  assert(
    [400, 500].includes(code) &&
      detail.includes("ROMDex acceptance forced rollback"),
    "intended post-mutation exception confirmed; earlier permission or runtime failures cannot pass",
  );
  log("FINAL " + JSON.stringify(after));
};
const execute = async (action) => {
  buttons.forEach((button) => {
    button.disabled = true;
  });
  output.textContent = "";
  try {
    await action();
  } catch (error) {
    log("FAIL " + error.message);
  } finally {
    buttons.forEach((button) => {
      button.disabled = false;
    });
  }
};
document.getElementById("read").onclick = () =>
  execute(async () => {
    log(JSON.stringify(await safeRead(), null, 2));
  });
document.getElementById("run").onclick = () => execute(run);
document.getElementById("rollback").onclick = () => execute(rollback);
output.textContent = "Ready. No request is sent until you choose a test.";
