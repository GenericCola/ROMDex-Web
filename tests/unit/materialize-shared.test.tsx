import assert from "node:assert/strict";
import { test } from "node:test";
import { materialize } from "../../src/domain/accepted/core.mjs";
import { materializeShared } from "../../src/domain/materialize-shared";
import type { TaskItem, TaskOperation } from "../../src/domain/types";
const SEED = 20240611;
const CASES = 400;
const prng = (seed: number) => {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const STATES = ["To do", "In Progress", "Standby", "Done", "Needs Testing"];
const task = (id: string, parentId: string | null, n: number): TaskItem => {
  return {
    id,
    summary: `Task ${id}`,
    description: `Notes ${n}`,
    parentId,
    state: STATES[n % STATES.length] ?? "To do",
    priority: "Normal",
    complexity: null,
    type: "Task",
    updated: n,
    comments: [{ id: `c${n}`, text: "hi", author: "a", created: n }],
    commentCount: 1,
    tags: ["x", `t${n}`],
  };
};
const fixture = (rand: () => number): { remote: TaskItem[]; ids: string[] } => {
  const count = 50 + Math.floor(rand() * 151);
  const remote: TaskItem[] = [];
  for (let i = 0; i < count; i += 1) {
    const level = Math.min(3, Math.floor(Math.log2(i + 1) / 1.5));
    const pool = remote.filter((_, index) => {
      return index < Math.max(1, i / 2) && level > 0;
    });
    const parent = pool.length
      ? (pool[Math.floor(rand() * pool.length)]?.id ?? null)
      : null;
    remote.push(task(`T-${i}`, level === 0 ? null : parent, i));
  }
  return { remote, ids: remote.map((item) => item.id) };
};
const pick = (rand: () => number, ids: string[]): string => {
  const extra = ["T-missing", "T-new-1", "T-new-2"];
  const all = rand() < 0.1 ? extra : ids;
  return all[Math.floor(rand() * all.length)] ?? "T-0";
};
const makeOp = (
  rand: () => number,
  ids: string[],
  index: number,
): TaskOperation => {
  const opId = `op-${index}`;
  const issueId = pick(rand, ids);
  const roll = rand();
  if (roll < 0.1) {
    const id = rand() < 0.5 ? `T-new-${1 + Math.floor(rand() * 2)}` : issueId;
    return {
      opId,
      type: "create",
      issueId: id,
      item: task(id, pick(rand, ids), 900 + index),
    };
  }
  if (roll < 0.45) {
    const base = task(issueId, null, 0);
    const kind = rand();
    if (kind < 0.3)
      return {
        opId,
        type: "edit",
        issueId,
        base,
        patch: { parentId: rand() < 0.15 ? null : pick(rand, ids) },
      };
    if (kind < 0.5)
      return {
        opId,
        type: "edit",
        issueId,
        base,
        patch: { state: STATES[Math.floor(rand() * 5)] ?? "Done" },
      };
    if (kind < 0.6)
      return {
        opId,
        type: "edit",
        issueId,
        base,
        patch: { state: "Done", assignedState: "In Progress" },
      };
    return {
      opId,
      type: "edit",
      issueId,
      base,
      patch: { description: `edited ${index}`, tags: [`e${index}`] },
    };
  }
  if (roll < 0.6)
    return {
      opId,
      type: "attachment",
      issueId,
      uploadId: `up-${index}`,
      file: {
        name: `f${index}.png`,
        size: index,
        mimeType: "image/png",
        hash: `h${index}`,
      },
    };
  if (roll < 0.7)
    return {
      opId,
      type: "attachment-delete",
      issueId,
      attachmentId: `a-${index}`,
      base: {
        id: `a-${index}`,
        name: "n",
        size: 1,
        mimeType: "x",
        created: 1,
        updated: 1,
        authorId: "u",
      },
    };
  if (roll < 0.8) {
    const doomed = ids.filter((id) => {
      return id === issueId || rand() < 0.03;
    });
    return { opId, type: "delete", issueId, ids: doomed };
  }
  return { opId, type: "comment", issueId, text: "c", created: index };
};
test("materializeShared equals core materialize on random queues", () => {
  const rand = prng(SEED);
  for (let n = 0; n < CASES; n += 1) {
    const { remote, ids } = fixture(rand);
    const before = structuredClone(remote);
    const ops: TaskOperation[] = [];
    const total = 1 + Math.floor(rand() * 40);
    for (let i = 0; i < total; i += 1) ops.push(makeOp(rand, ids, i));
    const expected = materialize(remote, ops);
    const actual = materializeShared(remote, ops);
    assert.deepEqual(actual, expected, `case ${n} seed ${SEED}`);
    assert.deepEqual(
      actual.map((item) => item.id),
      expected.map((item) => item.id),
      `order case ${n}`,
    );
    assert.deepEqual(remote, before, `remote mutated, case ${n}`);
    const touched = new Set<string>();
    for (const op of ops) {
      touched.add(op.issueId);
      if (op.type === "delete") for (const id of op.ids) touched.add(id);
    }
    for (const item of actual) {
      const source = remote.find((entry) => entry.id === item.id);
      if (source && !touched.has(item.id)) assert.equal(item, source);
    }
  }
});
test("untouched items are the remote objects, touched ones are copies", () => {
  const rand = prng(7);
  const { remote } = fixture(rand);
  const [first, second] = remote;
  assert.ok(first && second);
  const out = materializeShared(remote, [
    {
      opId: "o",
      type: "edit",
      issueId: first.id,
      base: first,
      patch: { description: "new" },
    },
  ]);
  assert.notEqual(out[0], first);
  assert.equal(out[0]?.description, "new");
  assert.equal(first.description, "Notes 0");
  assert.equal(out[1], second);
});
