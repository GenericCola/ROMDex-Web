import { editTask, postComment } from "@/domain/task-actions";
import { taskEditingLocked } from "@/domain/task-edit-lock";
import type { TaskItem, WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import type { ChangeEvent } from "react";
import { useEffect, useRef } from "react";
import { useDetailNavigation } from "./detail-navigation-context";
import Pending from "./pending";
import TaskCommentList from "./task-comment-list";
import { queuedTaskComments, useTaskComments } from "./use-task-comments";
import { useTaskTextEditing } from "./use-task-text-editing";
const TaskWriting = ({
  item,
  data,
}: {
  item: TaskItem;
  data: WorkspaceData;
}) => {
  const readOnly = taskEditingLocked(item.id, data);
  const editing = useTaskTextEditing(item.id, "notes");
  const { tab, setTab, focusNotes } = useDetailNavigation();
  const nativeComments = useTaskComments(item.id, tab === "comments");
  const shownComments = nativeComments.comments ?? item.comments,
    remoteCount = nativeComments.comments?.length ?? item.commentCount;
  const notesRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (focusNotes?.id === item.id) notesRef.current?.focus();
  }, [focusNotes, item.id]);
  const description = (event: ChangeEvent<HTMLTextAreaElement>) => {
    if (taskEditingLocked(item.id)) return;
    const { value } = event.target;
    void workspaceStore.change((next) => {
      return editTask(next, item.id, { description: value });
    });
  };
  const comment = (event: ChangeEvent<HTMLTextAreaElement>) => {
    if (taskEditingLocked(item.id)) return;
    const { value } = event.target;
    void workspaceStore.change((next) => {
      next.commentDrafts[item.id] = value;
    });
  };
  const post = () => {
    if (taskEditingLocked(item.id)) return;
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
  const queued = queuedTaskComments(data.operations, item.id);
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
          <span id="comment-count">{remoteCount + queued.length || ""}</span>
        </button>
      </div>
      {tab === "notes" ? (
        <section id="notes-panel">
          <textarea
            id="notes"
            readOnly={readOnly}
            ref={notesRef}
            aria-label="Notes and Instructions"
            value={item.description}
            onChange={description}
            onCompositionStart={editing.compositionStart}
            onCompositionEnd={editing.compositionEnd}
            onFocus={editing.focus}
            onInput={editing.activity}
            onBlur={editing.blur}
            placeholder="Notes, Instructions, or a Development Prompt…"
          />
          <p className="editor-hint">
            {workspaceStore.getSnapshot().error
              ? "Local saving needs attention. Editing is paused; you can browse, export a recovery copy, or retry local saving."
              : readOnly
                ? "This ticket is being synchronized or needs delivery review. You can still browse and edit unrelated tickets."
                : "Edits save locally. When connected, Auto-Sync waits five minutes after typing while this editor stays focused. Leaving the editor or Save Changes can send the current version."}
          </p>
        </section>
      ) : (
        <section id="comments-panel">
          <Pending
            active={nativeComments.busy}
            label="Reading Comments…"
            message={nativeComments.message}
          />
          <TaskCommentList
            loading={nativeComments.busy}
            comments={[...shownComments, ...queued]}
            remoteCount={remoteCount}
          />
          {remoteCount > shownComments.length && (
            <p>Some remote comments have not been downloaded yet.</p>
          )}
          <textarea
            id="comment-input"
            readOnly={readOnly}
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
                !readOnly &&
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
            disabled={readOnly || !data.commentDrafts[item.id]?.trim()}
          >
            Post Comment
          </button>
        </section>
      )}
    </section>
  );
};
export default TaskWriting;
