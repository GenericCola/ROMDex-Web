import { stageGroup } from "@/domain/bulk-hierarchy";
import { registerDraftEditor } from "@/domain/editor-drafts";
import { workspaceStore } from "@/domain/workspace-store";
import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import Lamp from "./lamp";
import { useAttachmentWork } from "./use-attachment-work";

export interface GroupDraft {
  ids: string[];
  parentId: string | null;
  beforeId: string;
  expected: string;
  depth: number;
}
const GroupDraftRow = ({
  draft,
  close,
}: {
  draft: GroupDraft;
  close: () => void;
}) => {
  const [title, setTitle] = useState("");
  const titleRef = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { busy, message, run } = useAttachmentWork();
  useLayoutEffect(() => {
    inputRef.current?.focus();
  }, []);
  useLayoutEffect(() => {
    return registerDraftEditor({
      ticketIds: [...draft.ids, ...(draft.parentId ? [draft.parentId] : [])],
      label: "Unfinished new parent",
      dirty: () => {
        return titleRef.current.trim().length > 0;
      },
      capture: () => {
        return {
          kind: "group-parent",
          ids: draft.ids,
          parentId: draft.parentId,
          title: titleRef.current,
        };
      },
      flush: () => {
        return Promise.reject(
          Error(
            "Finish or cancel the new parent before switching workspace or updating.",
          ),
        );
      },
    });
  }, [draft, title]);
  const commit = () => {
    if (!title.trim()) {
      close();
      return;
    }
    run(async () => {
      await workspaceStore.change((data) => {
        stageGroup(data, draft.ids, title, draft.expected);
      });
      await workspaceStore.flush();
      close();
    });
  };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || busy || event.repeat) return;
    if (event.key === "Escape") {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      event.stopPropagation();
      close();
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      commit();
    }
  };
  return (
    <tr
      className="draft-row"
      style={{ "--depth": draft.depth } as CSSProperties}
    >
      <td>
        <div className="task-cell">
          <span className="row-gutter" />
          <div className="row-hierarchy">
            <span className="draft-indent" />
            <span className="draft-status">
              <Lamp color="grey" />
            </span>
            <input
              ref={inputRef}
              className="draft-input"
              aria-label="New Parent Title"
              placeholder="Parent Title…"
              value={title}
              disabled={busy}
              onKeyDown={keyDown}
              onChange={(event) => {
                titleRef.current = event.target.value;
                setTitle(event.target.value);
              }}
            />
          </div>
        </div>
      </td>
      <td colSpan={3} className="draft-hint">
        {message ? (
          <span role="alert">{message}</span>
        ) : (
          "Enter to Group · Esc to Cancel"
        )}
      </td>
    </tr>
  );
};
export default GroupDraftRow;
