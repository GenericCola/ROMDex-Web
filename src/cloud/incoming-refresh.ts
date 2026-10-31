import {
  authIdentity,
  authRequestGuard,
  authToken,
  hasAuthSession,
} from "@/auth/session";
import { materialize } from "@/domain/accepted/core.mjs";
import { draftTicketIds } from "@/domain/editor-drafts";
import { editingTicketIds } from "@/domain/task-editing";
import type { TaskItem } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { deliveryConnected, requireDelivery } from "./session";
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
        throw Error("The workspace changed while reading incoming updates.");
    };
    return { client, current };
  } catch {
    return null;
  }
};
let previous: ReturnType<typeof incomingContext>;
let revision = "",
  fullAt = 0,
  checkedAt = 0;
let cached: TaskItem[] = [];
let running: Promise<void> | null = null;
export const refreshIncoming = (
  force = false,
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
    revision = "";
    fullAt = 0;
    checkedAt = 0;
    cached = [];
  }
  const current = () => {
    if (!alive()) throw Error("Incoming update watcher stopped.");
    context.current();
  };
  const run = async () => {
    current();
    if (Date.now() - checkedAt >= 1000) {
      const next = await context.client.latestRevision();
      current();
      if (
        force ||
        next !== revision ||
        !fullAt ||
        Date.now() - fullAt >= 60000
      ) {
        const items = await context.client.all();
        current();
        await workspaceStore.applyIncoming(items, heldTickets(), current);
        current();
        cached = items;
        fullAt = Date.now();
        revision = next;
      } else if (cached.length) {
        await workspaceStore.applyIncoming(cached, heldTickets(), current);
      }
      checkedAt = Date.now();
    } else if (cached.length) {
      await workspaceStore.applyIncoming(cached, heldTickets(), current);
    }
  };
  running = run().finally(() => {
    running = null;
  });
  return running;
};
// Explicit edit entry reads this ticket before the user chooses a new value.
export const refreshIncomingTask = async (id: string) => {
  const context = incomingContext();
  if (context && /^PMON-\d+$/.test(id)) {
    const item = await context.client.get(id);
    context.current();
    if (!item)
      throw Error(
        "This ticket is no longer readable. Your pending changes are retained.",
      );
    await workspaceStore.applyIncoming([item], heldTickets(), context.current);
    context.current();
  }
  const { data } = workspaceStore.getSnapshot();
  const item = materialize(data.remote, data.operations).find((entry) => {
    return entry.id === id;
  });
  if (!item) throw Error("The ticket is no longer in this workspace.");
  return item;
};
