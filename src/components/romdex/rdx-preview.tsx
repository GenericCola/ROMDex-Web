import { jsonObject } from "@/domain/json";
import { nodeText, nodes } from "@/npcdex/model";
import type { RdxInspection } from "@/rdx/types";
import RdxConflict from "./rdx-conflict";
const RdxPreview = ({
  value,
  choices,
  choose,
}: {
  value: RdxInspection;
  choices: Record<string, string>;
  choose: (id: string, choice: string) => void;
}) => {
  const { document } = value,
    content = jsonObject(document.content);
  const conflicts = value.preview ? nodes(value.preview, "conflicts") : [];
  return (
    <section aria-label="RDX file preview">
      <h3>
        {nodeText(document, "kind") === "map"
          ? "NPCDex map"
          : "ROMDex task plan"}
      </h3>
      <p>
        Dataset: {nodeText(document, "datasetId")} · Document:{" "}
        {nodeText(document, "documentId")}
      </p>
      <p>
        Revision: <code>{nodeText(document, "revision")}</code>
      </p>
      <p>
        {nodeText(document, "kind") === "map"
          ? nodes(content, "records").length + " content revisions"
          : nodes(content, "tasks").length + " tasks"}{" "}
        · {nodes(document, "assetInventory").length} assets
      </p>
      <p>
        Imported claims do not establish ownership, implementation or testing.
        Task plans stay separate from the live PMON queue.
      </p>
      {value.projectionError && <p role="alert">{value.projectionError}</p>}
      {conflicts.map((conflict) => {
        const id = nodeText(conflict, "id");
        return (
          <RdxConflict
            key={id}
            conflict={conflict}
            choice={choices[id] ?? ""}
            choose={choose}
          />
        );
      })}
      <p>
        Full content, assets and history are retained in the RDX file. The
        preview lists at most 100 records.
      </p>
      <ul>
        {nodes(
          content,
          nodeText(document, "kind") === "map" ? "records" : "tasks",
        )
          .slice(0, 100)
          .map((record) => {
            return (
              <li
                key={nodeText(record, "revisionId", nodeText(record, "taskId"))}
              >
                {nodeText(record, "title", nodeText(record, "recordId"))}
              </li>
            );
          })}
      </ul>
    </section>
  );
};
export default RdxPreview;
