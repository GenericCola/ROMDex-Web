// Read-only original-desktop badge metadata. Counts link occurrences, not unique IDs.
export const linkedIssueCount = (links: unknown): number | undefined => {
  if (links === undefined) return undefined;
  if (!Array.isArray(links)) throw Error("Invalid linked-issue metadata.");
  let total = 0,
    known = true;
  for (const link of links) {
    if (!link || typeof link !== "object" || Array.isArray(link))
      throw Error("Invalid linked-issue metadata.");
    const type: unknown = Reflect.get(link, "linkType");
    if (type != null && (typeof type !== "object" || Array.isArray(type)))
      throw Error("Invalid linked-issue type.");
    const name: unknown = type ? Reflect.get(type, "name") : undefined;
    if (name !== undefined && typeof name !== "string")
      throw Error("Invalid linked-issue type.");
    if (!name) known = false;
    const issues: unknown = Reflect.get(link, "issues");
    if (
      !Array.isArray(issues) ||
      issues.some((issue) => {
        return (
          !issue ||
          typeof issue !== "object" ||
          Array.isArray(issue) ||
          typeof Reflect.get(issue, "id") !== "string" ||
          !Reflect.get(issue, "id")
        );
      })
    )
      throw Error("Invalid linked-issue list.");
    if (name === "Subtask") continue;
    total += issues.length;
    if (!Number.isSafeInteger(total))
      throw Error("Linked-issue count is too large.");
  }
  return known ? total : undefined;
};
