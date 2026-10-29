export const scopedWorkspaceKey = (
  instance: string,
  userId: string,
  projectId: string,
): string => {
  const url = new URL(instance);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "") ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(userId) ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(projectId)
  )
    throw Error("Invalid workspace scope.");
  return JSON.stringify(["youtrack", url.origin, userId, projectId]);
};
