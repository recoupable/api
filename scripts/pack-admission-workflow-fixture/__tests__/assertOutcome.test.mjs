import assert from "node:assert/strict";
import { test } from "node:test";
import { assertOutcome } from "../assertOutcome.mjs";
function specimen() {
  const runId = "run";
  const clock = { workflowRunId: runId, startedAt: 1000 };
  const state = { holdExpiresAt: "2099-01-01T00:00:00Z" };
  const trace = [{ action: "read", runId, jobId: "immediate", at: 1001 }];
  const journal = [
    { eventType: "run_created" },
    ...["startPackAdmissionStep", "readPackAdmissionStep"].map((name, i) => ({
      eventType: "step_created",
      correlationId: `step-${i}`,
      eventData: { stepName: `step//./${name}//${name}` },
    })),
  ];
  const value = {
    status: "admitted",
    job_id: "immediate",
    workflow_run_id: runId,
    hold_expires_at: state.holdExpiresAt,
    deadline_at: 31000,
  };
  return { runId, clock, state, trace, journal, value };
}
const check = f =>
  assertOutcome("immediate", f.runId, f.state, f.trace, f.journal, f.value, f.clock);
test("accepts correctly bound immediate admission", () => check(specimen()));
for (const [name, mutate] of [
  [
    "reset deadline",
    f => {
      f.value.deadline_at++;
    },
  ],
  [
    "wrong run",
    f => {
      f.value.workflow_run_id = "other";
    },
  ],
  [
    "changed hold",
    f => {
      f.value.hold_expires_at = "2100-01-01T00:00:00Z";
    },
  ],
  [
    "provider effect",
    f => {
      f.trace[0].action = "provider";
    },
  ],
  [
    "second start",
    f => {
      f.journal.push({ eventType: "run_created" });
    },
  ],
  [
    "second clock",
    f => {
      f.journal.push(f.journal[1]);
    },
  ],
  [
    "cached poll",
    f => {
      f.trace.push(f.trace[0]);
    },
  ],
  [
    "unexpected step",
    f => {
      f.journal.push({ eventType: "step_created", eventData: { stepName: "step//provider" } });
    },
  ],
])
  test(`rejects ${name}`, () => {
    const f = specimen();
    mutate(f);
    assert.throws(() => check(f));
  });
