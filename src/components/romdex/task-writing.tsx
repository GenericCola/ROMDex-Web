import { editTask, postComment } from "@/domain/task-actions";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import type { ChangeEvent } from "react";
import { useState } from "react";
import { useTaskTextEditing } from "./use-task-text-editing";
const renderComment = (entry: { id: string; text: string; author: string }) => {
  return (
    <article key={entry.id}>
      <strong>{entry.author}</strong>
      <p className="port-detail-text">{entry.text}</p>
    </article>
  );
};
const TaskWriting = ({
  item,
  data,
}: {
  item: TaskItem;
  data: WorkspaceData;
}) => {
  const editing = useTaskTextEditing(item.id, "notes");
  const [tab, setTab] = useState<"notes" | "comments">("notes");
  const description = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = event.target;
    void workspaceStore.change((next) => {
      return editTask(next, item.id, { description: value });
    });
  };
  const comment = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = event.target;
    void workspaceStore.change((next) => {
      next.commentDrafts[item.id] = value;
    });
  };
  const post = () => {
    void workspaceStore.change((next) => {
      return postComment(next, item.id);
    });
  };
  const notes = () => {
    return setTab("notes");
  };
  const comments = () => {
    return setTab("comments");
  };
  const queued = data.operations
    .filter((operation) => {
      return operation.type === "comment" && operation.issueId === item.id;
    })
    .map((operation) => {
      return {
        id: operation.opId,
        text: operation.type === "comment" ? operation.text : "",
        author: "You · awaiting sync",
      };
    });
  return (
    <section className="detail-writing" aria-label="Task Notes and Comments">
      <div className="detail-tabs">
        <button onClick={notes} aria-pressed={tab === "notes"}>
          Notes &amp; Instructions
        </button>
        <button onClick={comments} aria-pressed={tab === "comments"}>
          Comments {item.commentCount + queued.length}
        </button>
      </div>
      {tab === "notes" ? (
        <section>
          <textarea
            id="notes"
            aria-label="Notes and Instructions"
            value={item.description}
            onChange={description}
            onFocus={editing.focus}
            onBlur={editing.blur}
            placeholder="Notes, Instructions, or a Development Prompt…"
          />
          <p className="editor-hint">
            Edits save locally. When connected, Auto-Sync waits until you leave
            this editor. Save Changes can send the current version.
          </p>
        </section>
      ) : (
        <section>
          <div>{[...item.comments, ...queued].map(renderComment)}</div>
          {item.commentCount > item.comments.length && (
            <p>Some remote comments have not been downloaded yet.</p>
          )}
          <textarea
            aria-label="Write a Comment"
            value={data.commentDrafts[item.id] ?? ""}
            onChange={comment}
          />
          <button
            className="primary"
            onClick={post}
            disabled={!data.commentDrafts[item.id]?.trim()}
          >
            Post Comment
          </button>
        </section>
      )}
    </section>
  );
};
export default TaskWriting;
