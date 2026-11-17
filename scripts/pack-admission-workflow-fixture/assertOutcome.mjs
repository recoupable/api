import assert from "node:assert/strict";
export function assertOutcome(scenario, runId, state, trace, journal, value, startClock) {
  assert.equal(value.job_id, scenario);
  assert.equal(value.workflow_run_id, runId);
  assert(
    trace.length > 0 &&
      trace.every(e => e.action === "read" && e.runId === runId && e.jobId === scenario),
  );
  assert.equal(
    journal.filter(e => e.eventType === "run_created").length,
    1,
    "only the original dispatch may exist",
  );
  const created = journal.filter(e => e.eventType === "step_created");
  const clocks = created.filter(e => e.eventData.stepName.endsWith("//startPackAdmissionStep"));
  const reads = created.filter(e => e.eventData.stepName.endsWith("//readPackAdmissionStep"));
  assert.equal(clocks.length, 1, "restart must replay the original journaled clock");
  assert.equal(reads.length, trace.length, "each poll must be a distinct durable invocation");
  assert.equal(new Set(reads.map(e => e.correlationId)).size, reads.length);
  assert(
    created.every(e =>
      ["startPackAdmissionStep", "readPackAdmissionStep"].some(name =>
        e.eventData.stepName.endsWith(`//${name}`),
      ),
    ),
  );
  const waits = journal.filter(e => e.eventType === "wait_created");
  assert.equal(startClock.workflowRunId, runId);
  assert.equal(value.deadline_at, startClock.startedAt + 30000);
  if (["immediate", "delayed"].includes(scenario)) {
    assert.equal(value.status, "admitted");
    assert.equal(value.hold_expires_at, state.holdExpiresAt);
    if (scenario === "immediate") {
      assert.equal(trace.length, 1);
      assert.equal(waits.length, 0);
    } else {
      assert(trace.length >= 2);
      assert(waits.length >= 1);
    }
  } else {
    assert.equal(value.status, "needs-reconciliation");
    assert.equal(value.reason, scenario === "read-failure" ? "read-failed" : scenario);
    assert.equal(value.hold_expires_at, scenario === "read-failure" ? null : state.holdExpiresAt);
    if (scenario === "deadline") {
      assert(trace.length >= 2 && trace.length <= 31);
      assert(trace.at(-1).at >= value.deadline_at);
      assert(waits.length >= 1);
    } else {
      assert.equal(trace.length, 1);
      assert.equal(waits.length, 0);
    }
  }
}
