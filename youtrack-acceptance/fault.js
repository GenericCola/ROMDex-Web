const status = require("./status");
const records = require("./status-record");
exports.httpHandler = {
  endpoints: [{
    scope: "issue", method: "POST", path: "rollback", permissions: ["UPDATE_ISSUE"],
    handle: (ctx) => {
      ctx.response.addHeader("Cache-Control", "no-store");
      try {
        const field = status.checkAcceptanceIssue(ctx.issue, ctx.currentUser, true);
        let body;
        try { body = ctx.request.json(); } catch { records.fail(400, "Invalid rollback request."); }
        if (body?.schema !== 1 || typeof body.opId !== "string" ||
            !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.opId))
          records.fail(400, "Invalid rollback request.");
        if (!records.load(ctx.issue) || ctx.issue.fields.State?.name === "Open")
          records.fail(409, "Initialize the fixture and use a non-Open State before rollback.");
        const value = field.values.find((entry) => entry.name === "Open");
        if (!value) records.fail(422, "Acceptance Open value is unavailable.");
        ctx.issue.fields.State = value;
        ctx.issue.extensionProperties.assignedStatus = "forced-rollback-must-not-persist";
        const marker = "ROMDex acceptance forced rollback " + body.opId;
        console.error(marker);
        throw Error(marker);
      } catch (error) {
        if (!(error instanceof records.StatusError)) throw error;
        ctx.response.code = error.status;
        ctx.response.json({error: error.message});
      }
    },
  }],
};
