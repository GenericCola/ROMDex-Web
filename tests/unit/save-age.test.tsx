import assert from "node:assert/strict";
import test from "node:test";
import {
  SAVE_ATTENTION_AFTER,
  saveOverdue,
} from "../../src/components/romdex/save-age";
void test("save age survives rerenders and new work; resolving old work resets only its age", () => {
  const ages = new Map<string, number>(),
    keys = new Set(["old"]);
  assert.equal(saveOverdue(ages, keys, 100), false);
  assert.equal(
    saveOverdue(ages, new Set(keys), 100 + SAVE_ATTENTION_AFTER - 1),
    false,
  );
  keys.add("new");
  assert.equal(saveOverdue(ages, keys, 100 + SAVE_ATTENTION_AFTER), true);
  keys.delete("old");
  assert.equal(saveOverdue(ages, keys, 101 + SAVE_ATTENTION_AFTER), false);
  assert.equal(saveOverdue(ages, new Set(), 2 * SAVE_ATTENTION_AFTER), false);
  assert.equal(ages.size, 0);
  assert.equal(
    saveOverdue(ages, new Set(["old"]), 3 * SAVE_ATTENTION_AFTER),
    false,
  );
});
void test("recovered work with unknown age starts a full observation window", () => {
  const ages = new Map<string, number>();
  assert.equal(
    saveOverdue(ages, new Set(["restored"]), Date.UTC(2026, 10, 5)),
    false,
  );
  assert.equal(
    saveOverdue(
      ages,
      new Set(["restored"]),
      Date.UTC(2026, 10, 5) + SAVE_ATTENTION_AFTER,
    ),
    true,
  );
});
