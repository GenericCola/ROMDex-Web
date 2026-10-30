import { authRequestGuard, authToken, hasAuthSession } from "@/auth/session";
import { previewRequired, taskEditingLocked } from "@/domain/task-edit-lock";
import type { TaskComment, TaskOperation } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { readComments } from "@/youtrack/read-comments";
import { sessionRequest } from "@/youtrack/request";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useSelectionWork } from "./use-selection-work";
export const useTaskComments = (id: string, active: boolean) => {
  const work = useSelectionWork();
  const scopeRef = useRef({ id, active: false });
  const [preview, setPreview] = useState<{
    id: string;
    comments: TaskComment[];
    check: () => void;
  } | null>(null);
  useLayoutEffect(() => {
    const scope = { id, active: true };
    scopeRef.current = scope;
    return () => {
      scope.active = false;
    };
  }, [id, active]);
  const { run } = work;
  const loadedRef = useRef<string | null>(null);
  const load = useCallback(() => {
    if (!/^PMON-\d+$/.test(id) || !hasAuthSession()) return;
    const scope = scopeRef.current;
    const readOnly = taskEditingLocked(id);
    const epoch = workspaceStore.deliveryEpoch();
    run(async () => {
      const token = authToken(),
        assertCurrent = authRequestGuard(token);
      const comments = await readComments(sessionRequest(token), id);
      assertCurrent();
      if (!scope.active || scope.id !== id) return;
      if (previewRequired(epoch, readOnly)) {
        setPreview({ id, comments, check: assertCurrent });
        return;
      }
      setPreview(null);
      await workspaceStore.change((data) => {
        assertCurrent();
        const item = data.remote.find((entry) => {
          return entry.id === id;
        });
        if (!item)
          throw Error("The task changed while comments were being read.");
        item.comments = comments;
        item.commentCount = comments.length;
      });
      await workspaceStore.flush();
    });
  }, [id, run]);
  useEffect(() => {
    if (!active) {
      loadedRef.current = null;
      return;
    }
    if (work.busy || loadedRef.current === id) return;
    loadedRef.current = id;
    load();
  }, [active, id, load, work.busy]);
  let comments: TaskComment[] | null = null;
  if (preview?.id === id) {
    try {
      preview.check();
      ({ comments } = preview);
    } catch {
      /* Stale account data stays hidden. */
    }
  }
  return { ...work, load, comments };
};

export const queuedTaskComments = (operations: TaskOperation[], id: string) => {
  return operations.flatMap((operation) => {
    if (operation.type !== "comment" || operation.issueId !== id) return [];
    return [
      {
        id: operation.opId,
        text: operation.text,
        created: operation.created,
        author: "You · Pending",
        pending: true,
      },
    ];
  });
};
