export interface TagPort {
  prepare?: (
    issueId: string,
    desired: string[],
    before: string[],
  ) => Promise<void>;
  list: (issueId: string) => Promise<string[]>;
  add: (issueId: string, tagId: string) => Promise<void>;
  remove: (issueId: string, tagId: string) => Promise<void>;
}
export interface TagStep {
  tagId: string;
  action: "add" | "remove";
  before: string[];
  after: string[];
  status: "attempting" | "confirmed";
}
export const tagIds = (value: unknown): string[] => {
  if (
    !Array.isArray(value) ||
    value.some((id) => {
      return typeof id !== "string" || !/^[-\w]{1,100}$/.test(id);
    }) ||
    new Set(value).size !== value.length
  )
    throw Error("Invalid tag identities. No tag change was sent.");
  return [...(value as string[])].sort();
};
export const validateTagSelection = (
  desired: unknown,
  before: unknown,
  config: unknown,
) => {
  const target = tagIds(desired),
    current = tagIds(before);
  if (
    !config ||
    typeof config !== "object" ||
    !("ready" in config) ||
    config.ready !== true ||
    !("options" in config) ||
    !Array.isArray(config.options)
  )
    throw Error(
      "Native tag choices are unavailable. Existing tags are preserved.",
    );
  const allowed = config.options.map((entry: unknown) => {
    if (!entry || typeof entry !== "object" || !("id" in entry))
      throw Error("Invalid native tag choices.");
    return entry.id;
  });
  tagIds(allowed);
  if (
    target.some((id) => {
      return !current.includes(id) && !allowed.includes(id);
    })
  )
    throw Error("Choose an existing available tag. ROMDex never creates tags.");
  return target;
};
