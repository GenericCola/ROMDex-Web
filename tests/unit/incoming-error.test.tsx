import assert from "node:assert/strict";
import test from "node:test";
import {
  IncomingFailure,
  incomingFailureMessage,
  incomingStep,
  IncomingSuperseded,
} from "../../src/cloud/incoming-error";
import { YouTrackHttpError } from "../../src/youtrack/http-error";
test("incoming failures identify the read stage and safe HTTP recovery without raw payloads", () => {
  assert.match(
    incomingFailureMessage(
      new IncomingFailure("revision", new YouTrackHttpError(401)),
    ),
    /checking for changed tickets.*sign-in needs renewing/,
  );
  assert.match(
    incomingFailureMessage(
      new IncomingFailure("tasks", new YouTrackHttpError(429)),
    ),
    /reading the current tickets.*HTTP 429/,
  );
  const message = incomingFailureMessage(
    new IncomingFailure("apply", Error('{"private":"secret body"}')),
  );
  assert.match(message, /saved copy.*pending edits are kept/);
  assert.doesNotMatch(message, /private|secret|\{/);
  assert.match(
    incomingFailureMessage(
      new IncomingFailure(
        "apply",
        Error(
          "Incoming hierarchy has an unreadable parent. Nothing was applied.",
        ),
      ),
    ),
    /parent is missing or not readable/,
  );
});
test("step preserves expected superseded reads separately from failures and never retries work", async () => {
  const cancelled = new IncomingSuperseded("workspace changed");
  let calls = 0;
  await assert.rejects(
    incomingStep("tasks", async () => {
      calls++;
      throw cancelled;
    }),
    (error) => error === cancelled,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    incomingStep("revision", async () => {
      throw new YouTrackHttpError(403);
    }),
    (error) => error instanceof IncomingFailure && error.stage === "revision",
  );
});
