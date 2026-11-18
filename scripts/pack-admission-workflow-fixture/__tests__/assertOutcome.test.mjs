import assert from "node:assert/strict";
import { test } from "node:test";
import { assertOutcomeWithDiagnostics } from "../assertOutcomeWithDiagnostics.mjs";
import { assertOutcome } from "../assertOutcome.mjs";
function specimen() {
  const runId = "run";
  const clock = { workflowRunId: runId, startedAt: 1000 };
  const state = { holdExpiresAt: "2099-01-01T00:00:00Z" };
  const trace = [{ action: "read", runId, jobId: "immediate", at: 1001, stepId: "step-1" }];
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
  return {
    runId,
    clock,
    state,
    trace,
    journal,
    value,
    observations: [
      {
        observedAt: 1001,
        workflowRunId: runId,
        job: { workflow_run_id: runId, hold_expires_at: state.holdExpiresAt },
      },
    ],
  };
}
const check = f =>
  assertOutcome(
    "immediate",
    f.runId,
    f.state,
    f.trace,
    f.journal,
    f.value,
    f.clock,
    f.observations,
  );
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

function delayed() {
  const f = specimen();
  f.value.job_id = "delayed";
  f.trace[0].jobId = "delayed";
  f.trace.push({ action: "read", runId: f.runId, jobId: "delayed", at: 2001, stepId: "step-2" });
  f.journal.push({
    eventType: "step_created",
    correlationId: "step-2",
    eventData: { stepName: "step//./readPackAdmissionStep//readPackAdmissionStep" },
  });
  f.journal.push({ eventType: "wait_created", eventData: { resumeAt: new Date(2001) } });
  f.observations[0].job.workflow_run_id = null;
  f.observations.push({
    ...f.observations[0],
    observedAt: 2001,
    job: { ...f.observations[0].job, workflow_run_id: f.runId },
  });
  return f;
}
const checkDelayed = f =>
  assertOutcome("delayed", f.runId, f.state, f.trace, f.journal, f.value, f.clock, f.observations);
test("accepts exact scheduled wake boundary", () => checkDelayed(delayed()));
for (const [name, mutate] of [
  [
    "long poll",
    f => {
      f.journal.at(-1).eventData.resumeAt = new Date(2002);
    },
  ],
  [
    "missing wait",
    f => {
      f.journal.pop();
    },
  ],
  [
    "extra wait",
    f => {
      f.journal.push(f.journal.at(-1));
    },
  ],
  [
    "repeated pre-crash read",
    f => {
      f.trace[1].stepId = f.trace[0].stepId;
    },
  ],
])
  test(`rejects ${name}`, () => {
    const f = delayed();
    mutate(f);
    assert.throws(() => checkDelayed(f));
  });

for (const scenario of ["hold-expiry", "deadline"]) {
  test(`accepts ${scenario} crossed during the final read`, () => {
    const f = delayed();
    const boundary = scenario === "deadline" ? f.value.deadline_at : 2002;
    if (scenario === "hold-expiry") f.state.holdExpiresAt = new Date(boundary).toISOString();
    f.value = {
      ...f.value,
      job_id: scenario,
      status: "needs-reconciliation",
      reason: scenario === "hold-expiry" ? "expired-hold" : "deadline",
      hold_expires_at: f.state.holdExpiresAt,
    };
    for (const entry of f.trace) entry.jobId = scenario;
    f.trace.at(-1).at = boundary - 1;
    for (const observation of f.observations) {
      observation.job.workflow_run_id = null;
      observation.job.hold_expires_at = f.state.holdExpiresAt;
    }
    f.observations.at(-1).observedAt = boundary;
    const verify = () =>
      assertOutcome(
        scenario,
        f.runId,
        f.state,
        f.trace,
        f.journal,
        f.value,
        f.clock,
        f.observations,
      );
    verify();
    f.observations.at(-1).observedAt = boundary - 1;
    assert.throws(verify, "must reject reconciliation before the observation reaches its boundary");
  });
}

for (const [name, mutate] of [
  [
    "early logical wait",
    f => {
      f.journal.at(-1).eventData.resumeAt = new Date(2000);
    },
  ],
  [
    "late logical wait",
    f => {
      f.journal.at(-1).eventData.resumeAt = new Date(2002);
    },
  ],
  [
    "extra distinct logical wait",
    f => {
      f.journal.push({ ...f.journal.at(-1), eventId: "event-extra", correlationId: "wait-extra" });
    },
  ],
  [
    "repeated storage event",
    f => {
      f.journal.push(f.journal.at(-1));
    },
  ],
]) {
  test(`retains raw diagnostic evidence and rejects ${name}`, t => {
    const f = delayed();
    f.journal.at(-1).eventId = "event-wait";
    f.journal.at(-1).correlationId = "wait-original";
    f.journal.push({
      eventType: "wait_completed",
      eventId: "event-completed",
      correlationId: "wait-original",
    });
    const completion = f.journal.pop();
    mutate(f);
    f.journal.push(completion);
    f.journal.forEach((event, index) => {
      event.createdAt = new Date(1000 + index);
    });
    const emitted = [];
    t.mock.method(console, "error", (...args) => emitted.push(args));
    assert.throws(
      () =>
        assertOutcomeWithDiagnostics({
          scenario: "delayed",
          runId: f.runId,
          state: f.state,
          trace: f.trace,
          journal: f.journal,
          value: f.value,
          startClock: f.clock,
          observations: f.observations,
          beforeCrash: f.trace.slice(0, 1),
          deliveryContext: { phase: "resume", deliveries: 5, activeDeliveries: 0 },
        }),
      { code: "ERR_ASSERTION" },
    );
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0][0], "PACK_ADMISSION_ASSERTION_FAILURE");
    const saved = JSON.parse(emitted[0][1]);
    assert.deepEqual(saved.observations, f.observations);
    assert.deepEqual(saved.beforeCrash, f.trace.slice(0, 1));
    assert.deepEqual(saved.deliveryContext, {
      phase: "resume",
      deliveries: 5,
      activeDeliveries: 0,
    });
    assert.deepEqual(saved.trace, f.trace);
    assert.deepEqual(
      saved.journal,
      JSON.parse(
        JSON.stringify(
          f.journal.map(event => ({
            eventId: event.eventId,
            eventType: event.eventType,
            correlationId: event.correlationId,
            createdAt: event.createdAt,
            stepName: event.eventData?.stepName,
            resumeAt: event.eventData?.resumeAt,
          })),
        ),
      ),
    );
  });
}
