import type { StoreName } from "../parts/manifest.ts";

/*
 * The store talks to YouTrack only through this transport, so the same code
 * runs in the browser (token or cookie sign-in) and in Node scripts.
 */

/** Sends one REST call to `<origin>/api/<route>`. A GET that finds nothing answers null. */
export type StoreRequest = (
  route: string,
  method?: string,
  body?: unknown,
  missingIsError?: boolean,
) => Promise<unknown>;

export interface AttachmentTarget {
  article: string;
  id: string;
}

export interface StoreTransport {
  request: StoreRequest;
  /** Downloads exactly `size` bytes from an attachment's signed URL. */
  download: (
    url: string,
    size: number,
    target: AttachmentTarget,
  ) => Promise<Uint8Array>;
}

/** Where one store lives and who may see it. */
export interface StoreTarget {
  store: StoreName;
  projectId: string;
  title: string;
  permittedUsers: string[];
}

/** thegobindsingh and GenericCola. */
export const PERMITTED_USERS = ["2-1", "2-2"];

export const STORE_TARGETS: Record<StoreName, StoreTarget> = {
  "romdex-metadata": {
    store: "romdex-metadata",
    projectId: "0-1",
    title: "ROMDex data",
    permittedUsers: PERMITTED_USERS,
  },
  npcdex: {
    store: "npcdex",
    projectId: "0-2",
    title: "NPCDex data",
    permittedUsers: PERMITTED_USERS,
  },
};
