import type { JsonObject } from "@/domain/json";
import type { NpcdexTarget } from "@/npcdex/model";
import { contentTarget, nodeText, nodes } from "@/npcdex/model";
const option = (node: JsonObject) => {
  return (
    <option key={nodeText(node, "id")} value={nodeText(node, "id")}>
      {nodeText(
        node,
        "name",
        nodeText(node, "condition", nodeText(node, "id")),
      )}
    </option>
  );
};
interface NavigationProps {
  document: JsonObject;
  target: NpcdexTarget;
  gender: string;
  stage: string;
  choose: (field: keyof NpcdexTarget, value: string) => Promise<void>;
  setGender: (value: string) => void;
  setStage: (value: string) => void;
}
const Navigation = ({
  document,
  target,
  gender,
  stage,
  choose,
  setGender,
  setStage,
}: NavigationProps) => {
  const current = contentTarget(document, target),
    fields: {
      key: keyof NpcdexTarget;
      label: string;
      placeholder: string;
      items: JsonObject[];
    }[] = [
      {
        key: "town",
        label: "Map",
        placeholder: "Choose a map",
        items: nodes(document, "towns"),
      },
      {
        key: "area",
        label: "Area",
        placeholder: "Choose an area",
        items: nodes(current.town, "areas"),
      },
      {
        key: "element",
        label: "Encounter",
        placeholder: "Choose an encounter",
        items: nodes(current.area, "elements"),
      },
      {
        key: "point",
        label: "Dialogue point",
        placeholder: "Choose a point",
        items: nodes(current.element, "points"),
      },
      {
        key: "block",
        label: "Dialogue block",
        placeholder: "All blocks in this point",
        items: nodes(current.point, "blocks"),
      },
    ];
  return (
    <div className="npcdex-navigation">
      {fields.map((field) => {
        return (
          <label key={field.key}>
            {field.label}
            <select
              value={target[field.key]}
              onChange={(event) => {
                void choose(field.key, event.target.value);
              }}
            >
              <option value="">{field.placeholder}</option>
              {field.items.map(option)}
            </select>
          </label>
        );
      })}
      <label>
        Player gender
        <select
          value={gender}
          onChange={(event) => {
            setGender(event.target.value);
          }}
        >
          <option value="male">Boy</option>
          <option value="female">Girl</option>
        </select>
      </label>
      <label>
        Timeline stage
        <select
          value={stage}
          onChange={(event) => {
            setStage(event.target.value);
          }}
        >
          <option value="">All stages</option>
          {nodes(document, "stages").map(option)}
        </select>
      </label>
    </div>
  );
};
export default Navigation;
