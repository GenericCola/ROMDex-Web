import { STORE_TITLES, type StoreName } from "@/store/parts/manifest";
import type { ReviewItem, StoreState } from "./cache";
import type { SyncOutcome } from "./sync";

export const STORES: StoreName[] = ["romdex-metadata", "npcdex"];

export type StoreStatusKind =
  | "idle"
  | "off"
  | "syncing"
  | "synced"
  | "waiting"
  | "not-set-up"
  | "ambiguous"
  | "busy"
  | "error";

export interface StoreStatus {
  store: StoreName;
  title: string;
  kind: StoreStatusKind;
  message: string;
  review: ReviewItem[];
  refused: StoreState["refused"];
  ids: string[];
}

export const statusOf = (
  store: StoreName,
  kind: StoreStatusKind,
  message: string,
): StoreStatus => {
  return {
    store,
    title: STORE_TITLES[store],
    kind,
    message,
    review: [],
    refused: [],
    ids: [],
  };
};

const WAITING = "Saved in this browser; waiting to sync.";

export const outcomeStatus = (
  store: StoreName,
  outcome: SyncOutcome,
  state: StoreState,
): StoreStatus => {
  const title = STORE_TITLES[store];
  const kept = { review: state.review, refused: state.refused };
  switch (outcome.kind) {
    case "synced":
      return {
        ...statusOf(
          store,
          "synced",
          state.review.length
            ? `Needs review: ${state.review.length} changed on two devices.`
            : state.refused.length
              ? WAITING
              : "Synced with YouTrack.",
        ),
        ...kept,
      };
    case "not-set-up":
      return {
        ...statusOf(
          store,
          "not-set-up",
          `Not set up: YouTrack has no "${title}" article. Your data stays in this browser.`,
        ),
        ...kept,
      };
    case "ambiguous":
      return {
        ...statusOf(
          store,
          "ambiguous",
          `Several "${title}" articles exist (${outcome.ids.join(", ")}). Choose one before syncing.`,
        ),
        ...kept,
        ids: outcome.ids,
      };
    case "waiting":
      return { ...statusOf(store, "waiting", outcome.reason), ...kept };
    case "busy":
      return {
        ...statusOf(store, "busy", "Another device is saving. Try again."),
        ...kept,
      };
  }
};

export const offlineMessage = WAITING;
