import type { TaskComment } from "@/domain/types";
const TaskCommentList = ({
  comments,
  remoteCount,
  loading = false,
}: {
  loading?: boolean;
  comments: (TaskComment & { pending?: boolean })[];
  remoteCount: number;
}) => {
  return (
    <div id="comments">
      {comments.map((entry) => {
        return (
          <article
            key={entry.id}
            className={`comment${entry.pending ? " pending" : ""}`}
          >
            <header>
              {entry.author} · {new Date(entry.created).toLocaleString()}
            </header>
            <p>{entry.text}</p>
          </article>
        );
      })}
      {!comments.length && !remoteCount && !loading && (
        <p className="muted small">No comments yet.</p>
      )}
    </div>
  );
};
export default TaskCommentList;
