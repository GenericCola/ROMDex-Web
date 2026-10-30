import assert from "node:assert/strict";
import test from "node:test";
import {
  hasTaskComposition,
  hasTaskTextEditing,
  setTaskComposition,
  setTaskTextEditing,
  subscribeTaskEditing,
} from "../../src/domain/task-editing";
void test("idle focus is tracked without locking outgoing work for composition", () => {
  setTaskTextEditing("A:notes", true);
  try {
    assert.equal(hasTaskTextEditing(), true);
    assert.equal(hasTaskComposition(), false);
    setTaskComposition("A:notes", true);
    assert.equal(hasTaskComposition(), true);
    setTaskComposition("A:notes", false);
    assert.equal(hasTaskComposition(), false);
    assert.equal(hasTaskTextEditing(), true);
  } finally {
    setTaskTextEditing("A:notes", false);
  }
});
void test("blur or unmount cleanup releases that editor composition without releasing another", () => {
  setTaskTextEditing("A:title", true);
  setTaskTextEditing("B:comment", true);
  setTaskComposition("A:title", true);
  setTaskComposition("B:comment", true);
  try {
    setTaskTextEditing("A:title", false);
    assert.equal(hasTaskComposition(), true);
    assert.equal(hasTaskTextEditing(), true);
    setTaskTextEditing("B:comment", false);
    assert.equal(hasTaskComposition(), false);
    assert.equal(hasTaskTextEditing(), false);
    // A late compositionend is harmless after blur/unmount cleanup.
    setTaskComposition("B:comment", false);
    assert.equal(hasTaskComposition(), false);
  } finally {
    setTaskTextEditing("A:title", false);
    setTaskTextEditing("B:comment", false);
  }
});
void test("composition transitions and cleanup notify subscribers; unsubscribe is respected", () => {
  const observations: boolean[] = [];
  const stop = subscribeTaskEditing(() => {
    observations.push(hasTaskComposition());
  });
  try {
    setTaskTextEditing("C:notes", true);
    setTaskComposition("C:notes", true);
    setTaskComposition("C:notes", false);
    setTaskComposition("C:notes", true);
    setTaskTextEditing("C:notes", false);
    assert.deepEqual(observations, [false, true, false, true, false]);
    stop();
    setTaskTextEditing("C:notes", true);
    assert.equal(observations.length, 5);
  } finally {
    stop();
    setTaskTextEditing("C:notes", false);
  }
});
