import type { JsonObject } from "@/domain/json";
import { nodeText, nodes, rasterImage } from "@/npcdex/model";
const Content = ({
  town,
  area,
  element,
  point,
  gender,
  stage,
}: {
  town: JsonObject | undefined;
  area: JsonObject | undefined;
  element: JsonObject | undefined;
  point: JsonObject | undefined;
  gender: string;
  stage: string;
}) => {
  const image = rasterImage(area?.image) ?? rasterImage(town?.image);
  const blocks = nodes(point, "blocks").filter((block) => {
    return !block.gender || block.gender === "both" || block.gender === gender;
  });
  const stages = point?.stages;
  const visible = !stage || !Array.isArray(stages) || stages.includes(stage);
  return (
    <section aria-label="NPCDex current content" className="npcdex-current">
      <h2>{nodeText(town, "name", "NPCDex")}</h2>
      <p>{nodeText(town, "subtitle")}</p>
      {image && (
        <div
          className="npcdex-image"
          role="img"
          aria-label={nodeText(area, "name", nodeText(town, "name"))}
          style={{ backgroundImage: 'url("' + image + '")' }}
        />
      )}
      <h3>{nodeText(area, "name")}</h3>
      <h4>{nodeText(element, "name")}</h4>
      <p className="npcdex-preserve">{nodeText(element, "context")}</p>
      {point && (
        <>
          <h4>Condition</h4>
          <p>{nodeText(point, "condition")}</p>
          <p>
            Stages:{" "}
            {Array.isArray(stages)
              ? stages
                  .filter((value): value is string => {
                    return typeof value === "string";
                  })
                  .join(", ")
              : "Not specified"}
          </p>
          {!visible && (
            <p role="status">
              This point is outside the selected stage. Its content remains
              visible for review.
            </p>
          )}
          {blocks.map((block) => {
            return (
              <article key={nodeText(block, "id")} className="npcdex-block">
                <small>
                  {nodeText(block, "type", "dialogue")} ·{" "}
                  {nodeText(block, "gender", "both")}
                </small>
                <p className="npcdex-preserve">{nodeText(block, "text")}</p>
              </article>
            );
          })}
          {point.uncertain === true && (
            <p>Source timing or dialogue is marked uncertain.</p>
          )}
        </>
      )}
      {!element && <p>Select an encounter to inspect its current dialogue.</p>}
    </section>
  );
};
export default Content;
