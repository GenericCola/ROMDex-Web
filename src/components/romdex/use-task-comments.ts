import { authRequestGuard, authToken, hasAuthSession } from "@/auth/session";
import { workspaceStore } from "@/domain/workspace-store";
import { readComments } from "@/youtrack/read-comments";
import { sessionRequest } from "@/youtrack/request";
import { useCallback, useEffect, useRef } from "react";
import { useSelectionWork } from "./use-selection-work";
export const useTaskComments = (id: string, active: boolean) => {
  const work = useSelectionWork();
  const { run } = work;
  const loadedRef = useRef<string | null>(null);
  const load = useCallback(() => {
    if (!/^PMON-\d+$/.test(id) || !hasAuthSession()) return;
    run(async () => {
      const token = authToken(),
        assertCurrent = authRequestGuard(token);
      const comments = await readComments(sessionRequest(token), id);
      assertCurrent();
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
  return { ...work, load };
};
