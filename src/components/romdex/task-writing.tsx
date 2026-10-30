import { editTask, postComment } from "@/domain/task-actions";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import type { ChangeEvent } from "react";
import { useEffect, useRef } from "react";
import { useDetailNavigation } from "./detail-navigation-context";
import TaskCommentList from "./task-comment-list";
import { useTaskComments } from "./use-task-comments";
import { useTaskTextEditing } from "./use-task-text-editing";
const TaskWriting = ({
  item,
  data,
}: {
  item: TaskItem;
  data: WorkspaceData;
}) => {
  const editing = useTaskTextEditing(item.id, "notes");
  const { tab, setTab, focusNotes } = useDetailNavigation();
  const nativeComments = useTaskComments(item.id, tab === "comments");
  const notesRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (focusNotes?.id === item.id) notesRef.current?.focus();
  }, [focusNotes, item.id]);
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
    setTab("comments");
    if (tab === "comments") nativeComments.load();
  };
  const queued = data.operations
    .filter((operation) => {
      return operation.type === "comment" && operation.issueId === item.id;
    })
    .map((operation) => {
      return {
        id: operation.opId,
        text: operation.type === "comment" ? operation.text : "",
        author: "You · Pending",
        created: operation.type === "comment" ? operation.created : 0,
        pending: true,
      };
    });
  return (
    <section className="detail-writing" aria-label="Task Notes and Comments">
      <div className="detail-tabs">
        <button
          className={tab === "notes" ? "active" : ""}
          onClick={notes}
          aria-pressed={tab === "notes"}
        >
          Notes &amp; Instructions
        </button>
        <button
          className={tab === "comments" ? "active" : ""}
          onClick={comments}
          aria-pressed={tab === "comments"}
        >
          Comments{" "}
          <span id="comment-count">
            {item.commentCount + queued.length || ""}
          </span>
        </button>
      </div>
      {tab === "notes" ? (
        <section id="notes-panel">
          <textarea
            id="notes"
            ref={notesRef}
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
        <section id="comments-panel">
          {nativeComments.message && (
            <p role="status">{nativeComments.message}</p>
          )}
          {nativeComments.busy && <p role="status">Reading Comments…</p>}
          <TaskCommentList
            comments={[...item.comments, ...queued]}
            remoteCount={item.commentCount}
          />
          {item.commentCount > item.comments.length && (
            <p>Some remote comments have not been downloaded yet.</p>
          )}
          <textarea
            id="comment-input"
            aria-label="Write a Comment"
            placeholder="Write a Comment…"
            rows={4}
            value={data.commentDrafts[item.id] ?? ""}
            onChange={comment}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                (event.ctrlKey || event.metaKey) &&
                !event.altKey &&
                !event.nativeEvent.isComposing &&
                !event.repeat &&
                data.commentDrafts[item.id]?.trim()
              ) {
                event.preventDefault();
                post();
              }
            }}
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
