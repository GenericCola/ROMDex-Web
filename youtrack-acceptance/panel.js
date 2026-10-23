let host;
const output = document.getElementById("result");
const buttons = [...document.querySelectorAll("button")];
buttons.forEach((button) => { button.disabled = true; });
let busy = false;
const codeOf = (error) => error?.status ?? error?.statusCode ?? error?.response?.status;
const messageOf = (error) => {
  const message = typeof error === "string" ? error : typeof error?.message === "string" ? error.message : "";
  return (codeOf(error) ? "HTTP " + codeOf(error) + ": " : "") + (message?.trim() || "Request failed; check the app log.");
};
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
const text = (value) => typeof value === "string" && value.length > 0 && value.length <= 200;
const validBase = (value) => value && Number.isSafeInteger(value.revision) && value.revision >= 0 &&
  typeof value.initialized === "boolean" && (value.initialized ? value.revision > 0 : value.revision === 0) &&
  text(value.assignedState) && text(value.state) && (value.initialized || value.assignedState === value.state) &&
  Number.isSafeInteger(value.updated) && value.updated >= 0;
const validRequest = (value) => value?.schema === 1 && text(value.opId) && ["assign", "rollup"].includes(value.kind) &&
  text(value.value) && validBase(value.expected);
const validSnapshot = (value) => {
  if (!validBase(value)) return false;
  if (!value.initialized) return value.receipt === null;
  const receipt = value.receipt;
  if (!validRequest(receipt) || value.revision !== receipt.expected.revision + 1) return false;
  const lastState = receipt.kind === "assign" ? receipt.expected.state : receipt.value;
  const assigned = receipt.kind === "assign" ? receipt.value : receipt.expected.assignedState;
  return value.assignedState === (value.state === lastState ? assigned : value.state);
};
const safeRead = async () => {
  const value = await read();
  assert(
    ["NPCD-872", "NPCD-873"].includes(value?.id) && value?.schema === 1 && validSnapshot(value),
    "allowlisted live fixture and protocol",
  );
  return value;
};
const rejected = async (body) => {
  try {
    await write(body);
  } catch (error) {
    const code = codeOf(error);
    assert(
      code === 409,
      "stale or reused request rejected with HTTP 409 (received " + code + ")",
    );
    return;
  }
  throw Error("Rejected request was accepted");
};
const capabilities = async () => {
  const capability = await host.fetchApp("capabilities/check", { scope: false });
  assert(
    capability?.app === "romdex-status-acceptance" &&
      capability.project === "NPCD" &&
      capability.schema === 1 &&
      capability.statusRules === 4,
    "test app identity, protocol and status rules 4",
  );
};
const run = async () => {
  const before = await safeRead();
  if (before.id === "NPCD-872") {
    const child = await host.fetchYouTrack("issues/NPCD-873/extensionEndpoints/romdex-status-acceptance/status/assigned");
    assert(child?.id === "NPCD-873" && child.schema === 1 && validSnapshot(child) && child.state === "Done" && child.assignedState === "Done",
      "root test requires the child fixture restored to Done; no request was written");
  }
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
  const winner = results.findIndex((result) => result.status === "fulfilled");
  const loser = results.find((result) => result.status === "rejected");
  const winningRequest = [a, b][winner];
  assert(
    successes.length === 1 && codeOf(loser?.reason) === 409 &&
      final.revision === current.revision + 1 &&
      JSON.stringify(final.receipt) === JSON.stringify(winningRequest) &&
      final.assignedState === winningRequest.value && final.state === current.state,
    "same-revision concurrent requests admit exactly one writer with an exact receipt and HTTP 409 loser",
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
  const opId = crypto.randomUUID();
  let failure;
  try {
    await host.fetchApp("fault/rollback", {
      scope: true,
      method: "POST",
      body: { schema: 1, opId },
    });
  } catch (error) {
    failure = error;
  }
  const after = await read();
  assert(
    JSON.stringify(after) === JSON.stringify(before),
    "failed request left metadata, State and timestamp unchanged",
  );
  assert([400, 500].includes(codeOf(failure)), "rollback request returned a server failure");
  const marker = "ROMDex acceptance forced rollback " + opId;
  if (messageOf(failure).includes(marker)) assert(true, "correlated post-mutation exception confirmed");
  else log("PENDING verify this exact post-mutation marker in the app log: " + marker);
  log("FINAL " + JSON.stringify(after));
};
const execute = async (action) => {
  if (busy || !host) return;
  busy = true;
  buttons.forEach((button) => {
    button.disabled = true;
  });
  output.textContent = "";
  try {
    await capabilities();
    await action();
  } catch (error) {
    log("FAIL " + messageOf(error));
  } finally {
    busy = false;
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
try {
  host = await YTApp.register();
  buttons.forEach((button) => { button.disabled = false; });
  output.textContent = "Ready. No request is sent until you choose a test.";
} catch (error) {
  log("FAIL widget registration: " + messageOf(error));
}
