import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { setAuthSession } from "../../src/auth/session";
import {
  connectDelivery,
  disconnectDelivery,
  saveDelivery,
} from "../../src/cloud/session";
import type { DeliveryRecord } from "../../src/cloud/types";
import DeliveryControls from "../../src/components/romdex/delivery-controls";
import { syncControl } from "../../src/components/romdex/header-status";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { workspaceStore } from "../../src/domain/workspace-store";

test("paused recovery identifies the route and only offers retry without unresolved review; opening is read-only", async () => {
  const original = globalThis.fetch;
  let reads = 0;
  let writes = 0;
  globalThis.fetch = async (input, options) => {
    if (options?.method !== "GET") {
      writes++;
      throw Error("Unexpected write");
    }
    reads++;
    if (String(input).includes("users/me"))
      return Response.json({ id: "fixture" });
    throw Error("Synthetic connection interruption");
  };
  try {
    for (const status of [
      undefined,
      "ready",
      "conflict",
      "attempting",
      "uncertain",
    ] as const) {
      disconnectDelivery();
      const data = emptyWorkspace();
      data.operations = [
        {
          type: "comment",
          opId: "held",
          issueId: "PMON-499",
          text: "Kept comment",
          created: 1,
        },
      ];
      if (status === "ready")
        data.operations = [
          {
            type: "delete",
            opId: "held",
            issueId: "PMON-499",
            ids: ["PMON-499"],
          },
        ];
      data.commentDrafts.keep = "Kept draft";
      data.cloud = {
        autoSync: true,
        accountId: "fixture",
        records: status
          ? { held: { status, message: "Synthetic failure" } as DeliveryRecord }
          : {},
      };
      let revision = 0;
      await workspaceStore.switchPersistence({
        load: async () => ({ data, revision }),
        save: async () => ++revision,
      });
      setAuthSession({
        token: "synthetic",
        userId: "fixture",
        projectId: "0-1",
        expiresAt: Date.now() + 60000,
      });
      await connectDelivery("synthetic");
      if (status === undefined) await assert.rejects(saveDelivery());
      const before = JSON.stringify(workspaceStore.getSnapshot().data);
      const requests = reads;
      const html = renderToStaticMarkup(<DeliveryControls />);
      assert.match(html, /Signed in, but delivery is paused/);
      if (status === undefined || status === "ready")
        assert.match(html, /Retry queued changes/);
      else {
        assert.doesNotMatch(html, /Retry queued changes/);
        assert.match(html, /PMON-499/);
      }
      assert.equal(reads, requests, "render never starts readback or delivery");
      assert.equal(writes, 0);
      assert.equal(JSON.stringify(workspaceStore.getSnapshot().data), before);
    }
    assert.match(
      syncControl(true, true, true).description,
      /Review sync problems/,
    );
    assert.match(
      syncControl(true, true, true).description,
      /connection light beside Save Changes/,
    );
  } finally {
    disconnectDelivery();
    setAuthSession(null);
    globalThis.fetch = original;
  }
});
