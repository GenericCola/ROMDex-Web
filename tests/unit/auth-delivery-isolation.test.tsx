import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { authRequestGuard, setAuthSession } from "../../src/auth/session";
import {
  automaticDelivery,
  connectDelivery,
  deliveryConnected,
  deliveryPaused,
  disconnectDelivery,
  requireDelivery,
} from "../../src/cloud/session";
import { cloudData } from "../../src/cloud/types";
import { YouTrackHttpError } from "../../src/youtrack/http-error";
import { A, fixture, mockDeliveryFixture } from "../fixtures/review-isolation";
const setup = async (t: TestContext) => {
  const f = await fixture();
  setAuthSession({
    token: "synthetic-auth",
    userId: f.port.accountId,
    projectId: "0-1",
    expiresAt: Date.now() + 60_000,
  });
  mockDeliveryFixture(t, f);
  await connectDelivery("synthetic-auth", f.port.accountId);
  Object.assign(requireDelivery(), f.port);
  return f;
};
for (const kind of ["401", "403", "changed", "network"] as const)
  for (const last of [false, true])
    void test(`${kind} after upload dispatch with last=${last} preserves uncertainty and the correct session boundary`, async (t) => {
      const f = await setup(t),
        guard = authRequestGuard("synthetic-auth");
      const held = f.independent("file");
      let posts = 0;
      try {
        requireDelivery().files.upload = async () => {
          posts++;
          if (kind === "changed") {
            setAuthSession(null);
            guard();
          }
          throw kind === "network"
            ? Error("response interrupted")
            : new YouTrackHttpError(Number(kind));
        };
        await f.store.change((data) => {
          data.operations = last ? [held] : [held, f.edit(A, "following")];
        });
        await automaticDelivery();
        const global = kind === "401" || kind === "changed";
        assert.equal(posts, 1);
        assert.equal(cloudData(f.state()).records.safe?.status, "uncertain");
        assert.equal(f.uploads.size, 1);
        assert.equal(deliveryConnected(), !global);
        if (global) {
          assert.match(
            f.store.getSnapshot().connection,
            /Sign in with YouTrack again/,
          );
          assert.equal(cloudData(f.state()).records.following, undefined);
          assert.deepEqual(f.sent(), []);
        } else {
          assert.equal(deliveryPaused(), false);
          if (!last)
            assert.equal(
              cloudData(f.state()).records.following?.status,
              "confirmed",
            );
        }
        await automaticDelivery();
        assert.equal(posts, 1, "the uncertain upload is never replayed");
      } finally {
        disconnectDelivery();
        setAuthSession(null);
      }
    });
void test("401 during automatic readback disconnects even with no eligible writes", async (t) => {
  const f = await setup(t),
    held = f.independent("file");
  try {
    await f.store.change((data) => {
      data.operations = [held];
      cloudData(data).records.safe = {
        status: "uncertain",
        message: "retained receipt evidence",
        attachmentBeforeIds: [],
      };
    });
    requireDelivery().files.list = async () => {
      throw new YouTrackHttpError(401);
    };
    await automaticDelivery();
    assert.equal(deliveryConnected(), false);
    assert.match(
      f.store.getSnapshot().connection,
      /Sign in with YouTrack again/,
    );
    assert.equal(
      cloudData(f.state()).records.safe?.message,
      "retained receipt evidence",
    );
    assert.equal(f.uploads.size, 1);
  } finally {
    disconnectDelivery();
    setAuthSession(null);
  }
});
