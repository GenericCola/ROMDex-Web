// Synthetic PMON-sized workspace: 10 epics x 8 stories x 5 tasks = 490 issues.
const words =
  "map route trainer battle sprite tile palette script event flag warp npc dialogue gym badge item shop berry encounter".split(" ");
const text = (seed, count) => {
  let out = "";
  for (let i = 0; i < count; i++) out += words[(seed * 7 + i * 13) % words.length] + (i % 12 === 11 ? ".\n" : " ");
  return out;
};
const states = ["To do", "In Progress", "Done", "Done", "Standby", "To do", "Done"];
const priorities = ["Normal", "Major", "Minor", "Critical"];
export const buildTasks = () => {
  const tasks = [];
  let n = 1;
  const add = (parentId, type, seed) => {
    const id = "PMON-" + n++;
    tasks.push({
      id, parentId, type,
      summary: type + " " + text(seed, 5).trim(),
      description: seed % 4 === 0 ? "" : text(seed, 40 + (seed % 120)),
      state: states[seed % states.length],
      priority: priorities[seed % priorities.length],
      complexity: seed % 3 ? String((seed % 5) + 1) : null,
      updated: 1700000000000 + seed * 1000,
      commentsCount: seed % 6,
    });
    return id;
  };
  for (let e = 0; e < 10; e++) {
    const epic = add(null, "Epic", e);
    for (let s = 0; s < 8; s++) {
      const story = add(epic, "Story", e * 100 + s);
      for (let t = 0; t < 5; t++) add(story, "Task", e * 1000 + s * 10 + t);
    }
  }
  return tasks;
};
const fields = ["Type", "State", "Priority", "Complexity"];
export const rawIssue = (task) => ({
  id: "2-" + task.id.split("-")[1],
  idReadable: task.id,
  summary: task.summary,
  description: task.description,
  updated: task.updated,
  project: { id: "0-1", shortName: "PMON" },
  parent: { issues: task.parentId ? [{ idReadable: task.parentId }] : [] },
  customFields: [
    ...fields.map((name, i) => ({
      id: "92-" + i, name,
      $type: name === "State" ? "StateIssueCustomField" : "SingleEnumIssueCustomField",
      value: task[name.toLowerCase()] === null ? null : { name: task[name.toLowerCase()] },
    })),
    { id: "92-9", name: "Assignee", $type: "SingleUserIssueCustomField", value: { id: "1-1", login: "owner", name: "Owner", fullName: "Owner" } },
  ],
  tags: [],
  commentsCount: task.commentsCount,
  links: [],
});
export const fieldList = fields;
