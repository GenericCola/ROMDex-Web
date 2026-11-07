import { list, type YouTrackRequest } from "./request";
export interface PmonField {
  id: string;
  field: { name: string; fieldType: { id: string } };
}
/** The single verified PMON project; `message` is thrown when it is not exactly one. */
export const readPmonProject = async (
  request: YouTrackRequest,
  message = "Cannot verify the PMON project.",
) => {
  const projects = await list<{ id: string; shortName: string }>(
    request,
    "admin/projects",
    "id,shortName",
    "PMON",
  );
  const matches = projects.filter((project) => {
    return project.shortName === "PMON";
  });
  const project = matches[0];
  if (matches.length !== 1 || !project || !/^\d+-\d+$/.test(project.id))
    throw Error(message);
  return project;
};
/** The PMON project plus its custom fields (id, name and type). */
export const readPmonSchema = async (request: YouTrackRequest) => {
  const project = await readPmonProject(request);
  const schema = await list<PmonField>(
    request,
    "admin/projects/" + project.id + "/customFields",
    "id,field(name,fieldType(id))",
  );
  return { project, schema };
};
