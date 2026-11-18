import assert from "node:assert/strict";
/** Qualify the immutable snapshot returned at the observer's fully drained boundary. */
export async function drainAdmissionTrace(observer) {
  const trace = await observer.flush();
  assert.equal(trace.droppedEntries, 0);
  assert.equal(trace.persistenceError, undefined);
  assert(
    !trace.entries.some(entry => entry.stage === "observer-error"),
    "observer projection failed",
  );
  return trace;
}
