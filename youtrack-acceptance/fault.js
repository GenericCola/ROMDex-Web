const status = require("./status");
const records = require("./status-record");
exports.httpHandler = {
  endpoints: [
    {
      scope: "issue",
      method: "POST",
      path: "rollback",
      permissions: ["UPDATE_ISSUE"],
      handle: (ctx) => {
        const field = status.checkAcceptanceIssue(
          ctx.issue,
          ctx.currentUser,
          true,
        );
        records.load(ctx.issue);
        const value = field.values.find((entry) => entry.name === "Open");
        if (!value) throw Error("Acceptance Open value is unavailable.");
        // Both changes must roll back when an unexpected server exception escapes.
        ctx.issue.fields.State = value;
        ctx.issue.extensionProperties.assignedStatus =
          "forced-rollback-must-not-persist";
        throw Error("ROMDex acceptance forced rollback");
      },
    },
  ],
};
