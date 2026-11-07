import assert from "node:assert/strict";
import test from "node:test";
import {
  automaticDelivery,
  connectDelivery,
  deliveryPaused,
  disconnectDelivery,
  requireDelivery,
  saveDelivery,
} from "../../src/cloud/session";
import { cloudData } from "../../src/cloud/types";
import { A, fixture, mockDeliveryFixture } from "../fixtures/review-isolation";

for (const automatic of [true, false])
  for (const failure of ["lost", "size"])
    void test(`${automatic ? "automatic" : "manual"} fresh ${failure} holds only upload ticket and accepts later unrelated saves`, async (t) => {
      const f = await fixture();
      mockDeliveryFixture(t, f);
      try {
        await connectDelivery("synthetic-token", f.port.accountId);
        const active = requireDelivery();
        Object.assign(active, f.port);
        let posts = 0;
        active.files.upload = async () => {
          posts++;
          throw Error("lost response");
        };
        if (failure === "size")
          active.files.requireUploadSize = () => {
            throw Error("4 MB maximum; no request sent");
          };
        const held = f.independent("file");
        await f.store.change((data) => {
          data.operations = [held, f.edit(A, "first")];
        });
        if (automatic) await automaticDelivery();
        else await saveDelivery();
        assert.equal(deliveryPaused(), false);
        assert.equal(cloudData(f.state()).records.first?.status, "confirmed");
        assert.equal(
          cloudData(f.state()).records.safe?.status,
          failure === "size" ? "conflict" : "uncertain",
        );
        await f.store.change((data) => {
          data.titleDrafts[A] = "Durable later title";
          data.operations.push(f.edit(A, "later"));
        });
        await f.store.flush();
        assert.equal(f.state().titleDrafts[A], "Durable later title");
        await f.store.change((data) => {
          delete data.titleDrafts[A];
        });
        await automaticDelivery();
        assert.equal(cloudData(f.state()).records.later?.status, "confirmed");
        assert.equal(posts, failure === "size" ? 0 : 1);
        assert.equal(f.uploads.size, 1);
        assert.equal(deliveryPaused(), false);
      } finally {
        disconnectDelivery();
      }
    });
