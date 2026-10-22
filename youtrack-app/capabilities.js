exports.httpHandler = {
  endpoints: [
    {
      scope: "global",
      method: "GET",
      path: "check",
      handle: (ctx) => {
        ctx.response.addHeader("Cache-Control", "no-store");
        ctx.response.json({ schema: 1, app: "romdex-status", project: "PMON" });
      },
    },
  ],
};
