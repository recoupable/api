import assert from "node:assert/strict";
/** One startup recovery, one explicit terminal replay; no second startup dispatch. */
export function assertRecoveryTrace(trace, runId) {
  assert.equal(trace.droppedEntries, 0);
  assert.equal(trace.persistenceError, undefined);
  const calls = trace.entries.filter(
    e =>
      e.operation === "queue" &&
      e.stage === "call" &&
      e.input.runId === runId &&
      e.delivery === null,
  );
  assert.deepEqual(
    calls.map(e => e.source),
    ["world.start", "finish-hook", "terminal-replay"],
  );
  const messages = new Set(
    trace.entries
      .filter(e => e.operation === "queue" && e.stage === "return")
      .map(e => e.output.messageId),
  );
  for (const handler of trace.entries.filter(e => e.operation === "handler" && e.stage === "call"))
    assert(messages.has(handler.delivery.messageId), "every delivery has an observed SDK enqueue");
}
