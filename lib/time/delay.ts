/**
 * Promise wrapper around `setTimeout` for use inside retry loops and
 * other non-workflow-body waits.
 *
 * NOT a substitute for `workflow.sleep()` — that one creates durable
 * timer events in the workflow event log and is the correct tool
 * inside `"use workflow"` bodies. `delay()` is for ordinary async
 * code (including `"use step"` functions, which run as regular
 * non-replayable code).
 *
 * @param ms - Duration in milliseconds. Negative or 0 resolves on the
 *   next microtask tick (same behavior as `setTimeout(_, 0)`).
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
