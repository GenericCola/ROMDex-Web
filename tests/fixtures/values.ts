import assert from "node:assert/strict";

/** A promise with its resolver exposed. */
export const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

/** Asserts that a fixture entry exists and narrows it. */
export const required = <T>(value: T | undefined): T => {
  assert.notEqual(value, undefined, "Expected fixture entry to exist");
  if (value === undefined) throw new Error("Missing fixture entry");
  return value;
};
