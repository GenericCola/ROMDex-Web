import type { JsonObject } from "@/domain/json";
import type { WorkspaceData } from "@/domain/types";
import { nodeText, nodes } from "@/npcdex/model";
const Evidence = ({
  data,
  document,
  town,
}: {
  data: WorkspaceData;
  document: JsonObject;
  town: JsonObject | undefined;
}) => {
  return (
    <>
      <details>
        <summary>Timeline</summary>
        {nodes(document, "stages").map((entry) => {
          return (
            <p key={nodeText(entry, "id")}>
              {nodeText(entry, "id")} · {nodeText(entry, "name")} ·{" "}
              {nodeText(entry, "event")}
            </p>
          );
        })}
      </details>
      <details>
        <summary>Character registry</summary>
        {nodes(town, "characters").map((entry) => {
          return (
            <p key={nodeText(entry, "id")}>
              {nodeText(entry, "name")} · {nodeText(entry, "gender", "both")}
            </p>
          );
        })}
      </details>
      <details>
        <summary>Source and draft history</summary>
        <p>
          {Array.isArray(document.history) ? document.history.length : 0}{" "}
          preserved source history entries. {data.npcdexHistory?.length ?? 0}{" "}
          web draft revisions.
        </p>
        {data.npcdexHistory
          ?.slice(-30)
          .reverse()
          .map((entry) => {
            return (
              <p key={nodeText(entry, "id")}>
                {nodeText(entry, "at")} · {nodeText(entry, "target")}
              </p>
            );
          })}
      </details>
    </>
  );
};
export default Evidence;
