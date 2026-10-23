import type { JsonObject } from "@/domain/json";
import { jsonObject } from "@/domain/json";
import { nodes } from "./model";
const identified = (values: JsonObject[], label: string) => {
  const ids = new Set<string>();
  for (const value of values) {
    if (typeof value.id !== "string" || !value.id || ids.has(value.id))
      throw Error("Invalid or duplicate NPCDex " + label + " identity.");
    ids.add(value.id);
  }
};
export const validateNpcdex = (document: JsonObject) => {
  if (document.version !== 2 || !Array.isArray(document.towns))
    throw Error("Unsupported NPCDex document.");
  const towns = nodes(document, "towns");
  identified(towns, "map");
  for (const town of towns) {
    if (typeof town.name !== "string" || !Array.isArray(town.areas))
      throw Error("Invalid NPCDex map.");
    const areas = nodes(town, "areas");
    identified(areas, "area");
    for (const area of areas) {
      const elements = nodes(area, "elements");
      identified(elements, "encounter");
      for (const element of elements) {
        const points = nodes(element, "points");
        identified(points, "point");
        for (const point of points) {
          if (
            typeof point.condition !== "string" ||
            !Array.isArray(point.blocks) ||
            (point.stages !== undefined &&
              (!Array.isArray(point.stages) ||
                point.stages.some((stage) => {
                  return typeof stage !== "string";
                })))
          )
            throw Error("Invalid NPCDex dialogue point.");
          const blocks = nodes(point, "blocks");
          identified(blocks, "block");
          for (const block of blocks)
            if (
              typeof block.text !== "string" ||
              typeof block.type !== "string"
            )
              throw Error("Invalid NPCDex dialogue block.");
        }
      }
    }
  }
  if (document.annotations) jsonObject(document.annotations);
};
