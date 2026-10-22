const records = require("./status-record");
const rules = require("./status-rules");
const check = (issue, user, write = false) => {
  if (
    !issue ||
    !/^PMON-\d+$/.test(issue.id) ||
    issue.project?.shortName !== "PMON" ||
    !issue.isReported ||
    !issue.isVisibleTo(user) ||
    !issue.project.canBeReadBy("State", user) ||
    (write && !issue.project.canBeWrittenBy("State", user))
  )
    records.fail(403, "Task or State access is required.");
  const field = issue.project.findFieldByName("State");
  if (!field || field.typeName !== "state[1]" || !field.isVisibleInIssue(issue))
    records.fail(422, "A visible single State field is required.");
  return field;
};
const calculate = (root, user) => {
  const seen = new Set();
  const visit = (issue) => {
    if (seen.has(issue.id) || seen.size >= 1000)
      records.fail(409, "The hierarchy is cyclic or exceeds the rollup limit.");
    seen.add(issue.id);
    check(issue, user);
    const children = issue.links["parent for"];
    if (!children || typeof children.forEach !== "function")
      records.fail(422, "The Subtask relationship is unavailable.");
    const colors = [];
    children.forEach((child) => {
      colors.push(visit(child));
    });
    return (
      rules.rollup(colors) ||
      rules.statusOf(records.snapshot(issue, records.load(issue)).assignedState)
    );
  };
  const children = root.links["parent for"];
  if (!children || typeof children.isEmpty !== "function")
    records.fail(422, "The Subtask relationship is unavailable.");
  if (children.isEmpty())
    return rules.youTrackState(records.snapshot(root, records.load(root)).assignedState);
  return rules.youTrackState(rules.states[visit(root)]);
};
const read = (ctx) => {
  check(ctx.issue, ctx.currentUser);
  return records.snapshot(ctx.issue, records.load(ctx.issue));
};
const write = (ctx) => {
  const field = check(ctx.issue, ctx.currentUser, true);
  if (typeof ctx.request.body !== "string" || ctx.request.body.length > 5000)
    records.fail(400, "Invalid status request.");
  let body;
  try {
    body = ctx.request.json();
  } catch {
    records.fail(400, "Invalid status request.");
  }
  if (!records.request(body)) records.fail(400, "Unsupported status request.");
  const stored = records.load(ctx.issue),
    current = records.snapshot(ctx.issue, stored);
  if (stored?.receipt.opId === body.opId) {
    if (!records.sameRequest(stored.receipt, body))
      records.fail(409, "A status operation ID was reused.");
    return current;
  }
  const base = records.base(current);
  if (!Object.keys(base).every((key) => base[key] === body.expected[key]))
    records.fail(409, "Assigned status or task revision changed.");
  if (current.revision >= Number.MAX_SAFE_INTEGER)
    records.fail(422, "Status revision limit reached.");
  const value = field.values.find((candidate) => candidate.name === rules.youTrackState(body.value));
  if (!value) records.fail(422, "The requested State value is unavailable.");
  if (
    body.kind === "rollup" &&
    calculate(ctx.issue, ctx.currentUser) !== body.value
  )
    records.fail(409, "The calculated status changed.");
  const next = {
    schema: 1,
    revision: current.revision + 1,
    assignedState: body.kind === "assign" ? body.value : current.assignedState,
    lastState: body.kind === "rollup" ? body.value : current.state,
    receipt: body,
  };
  // The extension property and native State belong to the same YouTrack transaction.
  if (body.kind === "rollup") ctx.issue.fields.State = value;
  ctx.issue.extensionProperties.assignedStatus = JSON.stringify(next);
  return {
    ...current,
    revision: next.revision,
    initialized: true,
    assignedState: next.assignedState,
    state: next.lastState,
    receipt: body,
  };
};
const handle = (action) => (ctx) => {
  ctx.response.addHeader("Cache-Control", "no-store");
  try {
    ctx.response.json(action(ctx));
  } catch (error) {
    if (!(error instanceof records.StatusError)) throw error;
    ctx.response.code = error.status;
    ctx.response.json({ error: error.message });
  }
};
exports.httpHandler = {
  endpoints: [
    {
      scope: "issue",
      method: "GET",
      path: "assigned",
      permissions: ["READ_ISSUE"],
      handle: handle(read),
    },
    {
      scope: "issue",
      method: "POST",
      path: "assigned",
      permissions: ["UPDATE_ISSUE"],
      handle: handle(write),
    },
  ],
};
