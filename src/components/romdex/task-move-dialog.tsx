import {
  descendants,
  indexTree,
  materialize,
} from "@/domain/accepted/core.mjs";
import { commitExactTaskMove, taskPath } from "@/domain/task-move";
import { workspaceStore } from "@/domain/workspace-store";
import { useEffect, useRef, useState } from "react";
import Dialog from "./dialog";
import { useSelectionWork } from "./use-selection-work";

const TaskMoveDialog = ({
  id,
  summary,
  close,
}: {
  id: string;
  summary: string;
  close: () => void;
}) => {
  const [data] = useState(() => {
    return workspaceStore.getSnapshot().data;
  });
  const items = materialize(data.remote, data.operations);
  const tree = indexTree(items, data.order);
  const excluded = new Set([id, ...descendants(items, id)]);
  const [parentId, setParentId] = useState(tree.byId.get(id)?.parentId ?? "");
  const [beforeId, setBeforeId] = useState("");
  const [search, setSearch] = useState("");
  const aliveRef = useRef(true);
  const work = useSelectionWork();
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);
  const path = (key: string) => {
    return taskPath(tree.byId, key);
  };
  const query = search.toLowerCase();
  const parents = items.filter((item) => {
    return (
      !excluded.has(item.id) &&
      (item.id === parentId ||
        (path(item.id) + " " + item.id).toLowerCase().includes(query))
    );
  });
  parents.sort((a, b) => {
    return path(a.id).localeCompare(path(b.id));
  });
  const siblings = (tree.children.get(parentId || null) ?? []).filter(
    (item) => {
      return item.id !== id;
    },
  );
  const submit = () => {
    work.run(async () => {
      await commitExactTaskMove(
        data,
        id,
        parentId || null,
        beforeId || null,
        () => {
          return aliveRef.current;
        },
      );
      close();
    });
  };
  return (
    <Dialog
      title={"Move " + summary}
      desktop
      close={close}
      canClose={!work.busy}
    >
      <p>Choose the parent and position. Children move with the task.</p>
      <div className="exact-move-fields">
        <label>
          Find destination
          <input
            type="search"
            value={search}
            onChange={(event) => {
              return setSearch(event.target.value);
            }}
            disabled={work.busy}
          />
        </label>
        <label>
          Destination parent
          <select
            size={7}
            value={parentId}
            disabled={work.busy}
            onChange={(event) => {
              setParentId(event.target.value);
              setBeforeId("");
            }}
          >
            <option value="">All Tasks (top level)</option>
            {parents.map((item) => {
              return (
                <option key={item.id} value={item.id}>
                  {path(item.id)} · {item.id}
                </option>
              );
            })}
          </select>
        </label>
        <label>
          Position
          <select
            value={beforeId}
            disabled={work.busy}
            onChange={(event) => {
              return setBeforeId(event.target.value);
            }}
          >
            <option value="">At the end</option>
            {siblings.map((item) => {
              return (
                <option key={item.id} value={item.id}>
                  Before {item.summary} · {item.id}
                </option>
              );
            })}
          </select>
        </label>
        <p>
          Under {parentId ? path(parentId) : "All Tasks"},{" "}
          {beforeId
            ? "before " + tree.byId.get(beforeId)?.summary
            : "at the end"}
          .
        </p>
      </div>
      <p role="status">{work.message}</p>
      <div className="dialog-actions">
        <button onClick={close} disabled={work.busy}>
          Cancel
        </button>
        <button onClick={submit} disabled={work.busy}>
          {work.busy ? "Moving…" : "Move Task"}
        </button>
      </div>
    </Dialog>
  );
};
export default TaskMoveDialog;
