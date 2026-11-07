import type { JsonObject } from "@/domain/json";
import { readPmonSchema } from "./pmon-project";
import { list, type YouTrackRequest } from "./request";
export const readPlanSchema = async (
  request: YouTrackRequest,
): Promise<JsonObject> => {
  const { project, schema } = await readPmonSchema(request);
  const connection: JsonObject = {
    project: "PMON",
    projectId: project.id,
    complexity: { ready: false },
  };
  for (const name of ["State", "Priority", "Complexity", "Type"]) {
    const candidates = schema.filter((field) => {
      return field.field?.name === name;
    });
    const spec = candidates[0];
    const type = name === "State" ? "state[1]" : "enum[1]";
    if (
      candidates.length !== 1 ||
      spec?.field?.fieldType?.id !== type ||
      !/^[-\w]+$/.test(spec.id)
    ) {
      if (name !== "Complexity")
        throw Error("The project field cannot be verified: " + name);
      continue;
    }
    const values = await list<{ id: string; name: string }>(
      request,
      "admin/projects/" +
        project.id +
        "/customFields/" +
        spec.id +
        "/bundle/values",
      "id,name",
    );
    if (
      values.some((value) => {
        return typeof value.id !== "string" || typeof value.name !== "string";
      })
    )
      throw Error("Invalid project field choices.");
    if (name === "Complexity")
      connection.complexity = {
        ready: true,
        options: values.map((value) => {
          return value.name;
        }),
      };
    else
      connection[
        name === "State" ? "states" : name === "Type" ? "types" : "priorities"
      ] = values.map((value) => {
        return value.name;
      });
  }
  return connection;
};
