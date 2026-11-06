const entity = "[-A-Za-z0-9_]{1,100}";
const issue = "(?:PMON-[0-9]+|[0-9]+-[0-9]+)";
const article = "(?:[0-9]+-[0-9]+|[A-Z][A-Z0-9_]*-A-[0-9]+)";
const reads = [
  /^articles$/,
  new RegExp(`^articles/${article}(?:/attachments(?:/${entity})?)?$`),
  /^users\/me$/,
  /^issues$/,
  /^admin\/projects$/,
  new RegExp(
    `^admin/projects/${entity}/(?:customFields(?:/${entity}/bundle/values)?|timeTrackingSettings)$`,
  ),
  new RegExp(
    `^admin/customFieldSettings/bundles/user/${entity}/aggregatedUsers$`,
  ),
  /^issueLinkTypes$/,
  /^tags$/,
  new RegExp(`^issues/${issue}/links(?:/${entity}/issues)?$`),
  new RegExp(
    `^issues/${issue}(?:/(?:comments|attachments|tags)(?:/${entity})?)?$`,
  ),
];
const posts = [
  /^articles$/,
  new RegExp(`^articles/${article}(?:/attachments)?$`),
  /^issues$/,
  new RegExp(
    `^issues/PMON-[0-9]+(?:/(?:comments|attachments|tags)|/links/${entity}/issues)?$`,
  ),
];
const deletes = [
  /^issues\/PMON-[0-9]+$/,
  new RegExp(`^issues/PMON-[0-9]+/(?:attachments|tags)/${entity}$`),
  new RegExp(`^issues/PMON-[0-9]+/links/${entity}/issues/[0-9]+-[0-9]+$`),
];
/** This is a route boundary, not authorization: upstream per-user rights still apply. */
export const transportRoute = (route: string, method: string) => {
  if (
    route.length > 8192 ||
    /[\\#\u0000-\u0020]/.test(route) ||
    route.startsWith("/") ||
    /%2f|%5c|%2e/i.test(route)
  )
    throw Error("Unsupported YouTrack route");
  const url = new URL(route, "https://thegobindsingh.youtrack.cloud/api/");
  if (
    url.origin !== "https://thegobindsingh.youtrack.cloud" ||
    !url.pathname.startsWith("/api/")
  )
    throw Error("Unsupported YouTrack route");
  const path = url.pathname.slice(5);
  if (path !== route.split("?")[0] || url.username || url.password)
    throw Error("Unsupported YouTrack route");
  const permitted =
    method === "GET"
      ? reads
      : method === "POST"
        ? posts
        : method === "DELETE"
          ? deletes
          : [];
  if (!permitted.some((rule) => rule.test(path)))
    throw Error("Unsupported YouTrack route");
  for (const name of url.searchParams.keys())
    if (!["fields", "$top", "$skip", "query"].includes(name))
      throw Error("Unsupported query parameter");
  return url;
};
