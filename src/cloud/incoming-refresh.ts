import {
  authIdentity,
  authRequestGuard,
  authToken,
  hasAuthSession,
} from "@/auth/session";
import { draftTicketIds } from "@/domain/editor-drafts";
import { editingTicketIds } from "@/domain/task-editing";
import type { TaskItem } from "@/domain/types";
import { findWorkspaceItem } from "@/domain/workspace-item";
import { workspaceStore } from "@/domain/workspace-store";
import { checkedItems } from "./incoming-check";
import { incomingStep, IncomingSuperseded } from "./incoming-error";
import { deliveryConnected, requireDelivery } from "./session";
const savedItem = (id: string) => {
  return workspaceStore.getSnapshot().data.remote.find((item) => {
    return item.id === id;
  });
};
const heldTickets = () => {
  return new Set([...draftTicketIds(), ...editingTicketIds()]);
};
export const incomingContext = () => {
  const state = workspaceStore.getSnapshot();
  if (
    !state.ready ||
    state.error ||
    state.updating ||
    !hasAuthSession() ||
    !deliveryConnected()
  )
    return null;
  try {
    const client = requireDelivery(),
      token = authToken(),
      identity = authIdentity();
    client.assertCurrent();
    if (
      client.accountId !== identity.userId ||
      state.data.cloud?.accountId !== identity.userId
    )
      return null;
    const workspaceEpoch = workspaceStore.workspaceEpoch();
    const guard = authRequestGuard(token),
      epoch = workspaceStore.deliveryEpoch();
    const current = () => {
      guard();
      client.assertCurrent();
      const next = workspaceStore.getSnapshot();
      const now = authIdentity();
      if (
        requireDelivery() !== client ||
        workspaceStore.workspaceEpoch() !== workspaceEpoch ||
        now.userId !== identity.userId ||
        now.projectId !== identity.projectId ||
        workspaceStore.deliveryEpoch() !== epoch ||
        !next.ready ||
        next.error ||
        next.updating
      )
        throw new IncomingSuperseded("The workspace changed during this read.");
    };
    return { client, current };
  } catch {
    return null;
  }
};
/**
 * - `cached`: re-apply the last read (no request), e.g. after an editor closes.
 * - `check`: one light read of every issue's update time; read only what changed.
 * - `full`: read every issue (connect, Refresh, or when the light read cannot tell).
 */
export type IncomingMode = "cached" | "check" | "full";
let previous: ReturnType<typeof incomingContext>;
let cached: TaskItem[] = [],
  running: Promise<void> | null = null;
export const refreshIncoming = (
  mode: IncomingMode = "check",
  alive: () => boolean = () => {
    return true;
  },
): Promise<void> => {
  if (running) return running;
  const context = incomingContext();
  if (!context) return Promise.resolve();
  let stale = false;
  try {
    previous?.current();
  } catch {
    stale = true;
  }
  if (stale || previous?.client !== context.client) {
    previous = context;
    cached = [];
  }
  const current = () => {
    if (!alive()) throw new IncomingSuperseded("Incoming watcher stopped.");
    context.current();
  };
  const apply = async (items: TaskItem[]) => {
    await incomingStep("apply", () => {
      return workspaceStore.applyIncoming(items, heldTickets(), current);
    });
    current();
    cached = items;
  };
  const run = async () => {
    current();
    if (mode === "cached" || (mode === "check" && cached.length)) {
      const next =
        mode === "cached"
          ? cached
          : await checkedItems(context.client, cached, current, savedItem);
      if (next) {
        if (next.length) await apply(next);
        return;
      }
    }
    const items = await incomingStep("tasks", context.client.all);
    current();
    await apply(items);
  };
  running = run().finally(() => {
    running = null;
  });
  return running;
};
export const refreshIncomingTask = async (id: string) => {
  const context = incomingContext();
  if (context && /^PMON-\d+$/.test(id)) {
    const item = await context.client.get(id);
    context.current();
    if (!item)
      throw Error("Ticket unavailable. Your pending changes are retained.");
    await workspaceStore.applyIncoming(
      [item],
      heldTickets(),
      context.current,
      false,
    );
    context.current();
  }
  const { data } = workspaceStore.getSnapshot();
  const item = findWorkspaceItem(data, id);
  if (!item) throw Error("The ticket is no longer in this workspace.");
  return item;
};
