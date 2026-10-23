import type { JsonObject, JsonValue } from "@/domain/json";
import { nodeText } from "@/npcdex/model";
import { useState } from "react";
const Version = ({
  title,
  value,
}: {
  title: string;
  value: JsonValue | undefined;
}) => {
  const [open, setOpen] = useState(false);
  const preview = open ? (JSON.stringify(value, null, 2) ?? "") : "";
  return (
    <details
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
      }}
    >
      <summary>{title}</summary>
      {open && (
        <pre className="port-detail-text">
          {preview.slice(0, 65536)}
          {preview.length > 65536
            ? "\nPreview limited to 64 KiB; the full value remains in the source and retained RDX history."
            : ""}
        </pre>
      )}
    </details>
  );
};
const RdxConflict = ({
  conflict,
  choice,
  choose,
}: {
  conflict: JsonObject;
  choice: string;
  choose: (id: string, value: string) => void;
}) => {
  const id = nodeText(conflict, "id");
  return (
    <div>
      <p>
        {nodeText(conflict, "reason", id)} ({id})
      </p>
      <Version title="Browser version" value={conflict.local} />
      <Version title="Incoming version" value={conflict.incoming} />
      <label>
        Version for {id}
        <select
          value={choice}
          onChange={(event) => {
            choose(id, event.target.value);
          }}
        >
          <option value="">Choose a version</option>
          <option value="local">Keep browser version</option>
          <option value="incoming">Use incoming version</option>
        </select>
      </label>
    </div>
  );
};
export default RdxConflict;
