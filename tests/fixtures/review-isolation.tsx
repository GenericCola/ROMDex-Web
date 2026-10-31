import assert from "node:assert/strict";
import type {
  Attachment,
  StoredUpload,
  UploadStore,
} from "../../src/attachments/types";
import { automaticBatch } from "../../src/cloud/automatic-batch";
import { deliverQueue } from "../../src/cloud/delivery";
import { sha256 } from "../../src/domain/json";
import type { TaskOperation } from "../../src/domain/types";
import { setup } from "./delivery-navigation";
import { navigationPort } from "./navigation-port";
export const A = "PMON-900001",
  B = "PMON-900002",
  P = "PMON-900000";
export const fixture = async () => {
  const { store } = await setup();
  await store.change((data) => {
    data.operations = [];
    data.cloud = { accountId: "synthetic-owner", autoSync: true, records: {} };
  });
  const transport = navigationPort(store.getSnapshot().data.remote);
  const writes: string[] = [],
    uploads = new Map<string, StoredUpload>();
  const storage: UploadStore = {
    get: (id) => {
      return Promise.resolve(uploads.get(id));
    },
    put: (value) => {
      uploads.set(value.id, value);
      return Promise.resolve();
    },
    remove: (id) => {
      uploads.delete(id);
      return Promise.resolve();
    },
  };
  const bytes = new TextEncoder().encode("isolated file");
  const file = {
    name: "isolation.txt",
    size: bytes.length,
    mimeType: "text/plain",
    hash: await sha256(bytes),
  };
  const inventory = new Map<string, Attachment[]>();
  transport.port.comment = (id) => {
    writes.push("comment:" + id);
    return Promise.resolve({ id: "comment-1" });
  };
  transport.port.files = {
    list: (id) => {
      return Promise.resolve(inventory.get(id) ?? []);
    },
    upload: (id, value) => {
      writes.push("file:" + id);
      inventory.set(id, [
        {
          id: "file-1",
          ...value.file,
          created: 1,
          updated: 1,
          authorId: "synthetic-owner",
        },
      ]);
      return Promise.resolve({ id: "file-1" });
    },
    download: () => {
      return Promise.resolve(bytes);
    },
    remove: () => {
      return Promise.reject(Error("Unexpected file deletion"));
    },
  };
  const edit = (id: string, opId: string): TaskOperation => {
    return {
      type: "edit",
      issueId: id,
      opId,
      base: structuredClone(
        store.getSnapshot().data.remote.find((x) => {
          return x.id === id;
        })!,
      ),
      patch: { summary: "Local " + opId },
    };
  };
  const independent = (kind: string): TaskOperation => {
    if (kind === "comment")
      return {
        type: "comment",
        issueId: B,
        opId: "safe",
        text: "Independent comment",
      };
    if (kind === "file") {
      uploads.set("safe", { id: "safe", file, blob: new Blob([bytes]) });
      return {
        type: "attachment",
        issueId: B,
        opId: "safe",
        uploadId: "safe",
        file,
      };
    }
    return edit(B, "safe");
  };
  const run = async (automatic = false) => {
    const selected = automatic
      ? automaticBatch(store.getSnapshot().data)
      : undefined;
    let failure: unknown;
    let iterations = 0;
    try {
      await store.deliver((commit) => {
        return deliverQueue(
          () => {
            return store.getSnapshot().data;
          },
          commit,
          transport.port,
          storage,
          () => {
            return ++iterations <= 20;
          },
          selected,
        );
      }, selected);
    } catch (error) {
      failure = error;
    }
    assert.ok(
      iterations <= 20,
      "Delivery loop exceeded bounded progress guard",
    );
    return failure;
  };
  const sent = () => {
    return [
      ...transport.sent.map((id) => {
        return "scalar:" + id;
      }),
      ...writes,
    ];
  };
  return {
    store,
    ...transport,
    uploads,
    edit,
    independent,
    run,
    sent,
    state: () => {
      return store.getSnapshot().data;
    },
  };
};
