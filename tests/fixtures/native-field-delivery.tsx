export const rawIssue = () => {
  return {
    id: "3-1",
    idReadable: "PMON-1",
    summary: "Fixture",
    description: "",
    updated: 1,
    project: { shortName: "PMON" },
    parent: { issues: [] },
    comments: [],
    commentsCount: 0,
    tags: [],
    customFields: [
      {
        id: "f-state",
        name: "State",
        $type: "StateIssueCustomField",
        value: { name: "To do" },
      },
      {
        id: "f-priority",
        name: "Priority",
        $type: "SingleEnumIssueCustomField",
        value: { name: "Normal" },
      },
      {
        id: "f-type",
        name: "Type",
        $type: "SingleEnumIssueCustomField",
        value: { name: "Task" },
      },
      {
        id: "f-user",
        name: "Assignee",
        $type: "SingleUserIssueCustomField",
        value: null,
      },
      {
        id: "f-date",
        name: "Due Date",
        $type: "DateIssueCustomField",
        value: null,
      },
      {
        id: "f-period",
        name: "Estimate",
        $type: "PeriodIssueCustomField",
        value: null,
      },
    ] as { id: string; name: string; $type: string; value: unknown }[],
  };
};
export const schema = [
  {
    id: "f-period",
    canBeEmpty: true,
    field: { name: "Estimate", fieldType: { id: "period" } },
  },
  {
    id: "f-user",
    canBeEmpty: true,
    field: { name: "Assignee", fieldType: { id: "user[1]" } },
    bundle: { id: "8-1" },
  },
  {
    id: "f-date",
    canBeEmpty: true,
    field: { name: "Due Date", fieldType: { id: "date" } },
  },
];
export const nativeFixtureFetch = (
  raw: ReturnType<typeof rawIssue>,
  afterPost: (body: {
    customFields: { id: string; value: unknown }[];
  }) => void = () => {
    return undefined;
  },
): typeof fetch => {
  return (input, init) => {
    if (typeof input !== "string") throw Error("Unexpected fixture input");
    const path = new URL(input).pathname;
    if (init?.method === "POST") {
      const body = JSON.parse(
        typeof init.body === "string" ? init.body : "",
      ) as { customFields: { id: string; value: unknown }[] };
      for (const field of body.customFields) {
        const target = raw.customFields.find((value) => {
          return value.id === field.id;
        });
        if (!target) throw Error("Unknown fixture field");
        target.value = field.value;
      }
      afterPost(body);
      return Promise.resolve(new Response("{}"));
    }
    if (path === "/api/tags" || path === "/api/issues/PMON-1/tags")
      return Promise.resolve(Response.json(raw.tags));
    if (path === "/api/issues/PMON-1")
      return Promise.resolve(Response.json(raw));
    if (path === "/api/admin/projects")
      return Promise.resolve(Response.json([{ id: "0-1", shortName: "PMON" }]));
    if (path.endsWith("/customFields"))
      return Promise.resolve(Response.json(schema));
    if (path.endsWith("/aggregatedUsers"))
      return Promise.resolve(
        Response.json([{ id: "1-1", login: "fixture", name: "Fixture" }]),
      );
    if (path.endsWith("/timeTrackingSettings"))
      return Promise.resolve(Response.json({ enabled: false }));
    throw Error("Unexpected fixture route");
  };
};
