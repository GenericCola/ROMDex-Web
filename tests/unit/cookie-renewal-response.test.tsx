import assert from "node:assert/strict";
import test from "node:test";
import { parseRenewalChallenge } from "../../src/auth/cookie-renewal";

const challenge = () => ({
  renewable: true,
  csrf: "c".repeat(43),
  renewalId: "r".repeat(43),
  renewUntil: Date.now() / 1000 + 300,
});

test("renewal parser ignores absent and non-renewable challenges", () => {
  for (const value of [
    null,
    undefined,
    {},
    false,
    { renewable: false },
    { renewable: "true" },
  ])
    assert.equal(parseRenewalChallenge(value), null);
});

test("renewal parser returns only the verified challenge fields", () => {
  const value = challenge();
  assert.deepEqual(
    parseRenewalChallenge({ ...value, refreshToken: "excluded" }),
    {
      csrf: value.csrf,
      renewalId: value.renewalId,
      renewUntil: value.renewUntil,
    },
  );
});

test("renewal parser rejects malformed CSRF, rotation IDs and expired deadlines", () => {
  for (const invalid of [
    { csrf: null },
    { csrf: "c".repeat(42) },
    { csrf: "+".repeat(43) },
    { renewalId: null },
    { renewalId: "r".repeat(44) },
    { renewalId: "/".repeat(43) },
    { renewUntil: "123" },
    { renewUntil: NaN },
    { renewUntil: Infinity },
    { renewUntil: -Infinity },
    { renewUntil: 0 },
    { renewUntil: Date.now() / 1000 },
  ])
    assert.throws(
      () => parseRenewalChallenge({ ...challenge(), ...invalid }),
      /Invalid renewal response/,
    );
});
