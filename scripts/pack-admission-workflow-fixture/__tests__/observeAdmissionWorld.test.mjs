import { assertRecoveryTrace } from "../assertRecoveryTrace.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { observeAdmissionWorld } from "../observeAdmissionWorld.mjs";
function fixture() {
  const handlers = new Map();
  const world = {
    registerHandler(prefix, handler) {
      handlers.set(prefix, handler);
    },
    events: {
      create: async (_runId, data) => ({
        event: { ...data, eventId: `event-${data.correlationId}` },
      }),
      list: async () => ({
        data: [{ eventId: "page-event", correlationId: "wait" }],
        cursor: "next",
        hasMore: true,
      }),
    },
  };
  return { world, handlers, observer: observeAdmissionWorld(world) };
}
const request = id =>
  new Request("http://fixture", {
    headers: {
      "x-vqs-message-id": id,
      "x-vqs-message-attempt": "1",
      "x-vqs-queue-name": "__wkf_workflow_test",
    },
  });
test("interleaved deliveries preserve async identity without serialization", async () => {
  const { world, handlers, observer } = fixture();
  const gates = [];
  world.registerHandler("flow", async req => {
    await new Promise(resolve => gates.push(resolve));
    await world.events.create("run", {
      eventType: "wait_created",
      correlationId: req.headers.get("x-vqs-message-id"),
    });
    await world.events.list({ runId: "run", pagination: { cursor: "previous" } });
    return new Response();
  });
  const first = handlers.get("flow")(request("one"));
  const second = handlers.get("flow")(request("two"));
  assert.equal(gates.length, 2, "both handlers enter before either is released");
  gates[1]();
  await second;
  gates[0]();
  await first;
  const calls = observer
    .snapshot()
    .entries.filter(e => e.operation === "events.create" && e.stage === "call");
  assert.deepEqual(
    calls.map(e => [e.delivery.messageId, e.input.event.correlationId]),
    [
      ["two", "two"],
      ["one", "one"],
    ],
  );
  const pages = observer.snapshot().entries.filter(e => e.operation === "events.list");
  assert.equal(pages[0].input.pagination.cursor, "previous");
  assert.deepEqual(pages[1].output, {
    cursor: "next",
    hasMore: true,
    events: [
      {
        eventId: "page-event",
        eventType: undefined,
        correlationId: "wait",
        createdAt: undefined,
        resumeAt: undefined,
        stepName: undefined,
      },
    ],
  });
});
test("preserves exact promises, receiver, arguments and rejection", async () => {
  const failure = new Error("actual SDK failure");
  const promise = Promise.reject(failure);
  const args = ["run", { eventType: "wait_created", correlationId: "wait" }];
  const world = {
    registerHandler() {},
    events: {
      create(...actual) {
        assert.equal(this, world.events);
        assert.deepEqual(actual, args);
        return promise;
      },
    },
  };
  const observer = observeAdmissionWorld(world);
  assert.equal(world.events.create(...args), promise);
  await assert.rejects(promise, error => error === failure);
  const entries = observer.snapshot().entries.filter(e => e.operation === "events.create");
  assert.equal(entries[0].delivery, null);
  assert.equal(entries[1].stage, "reject");
  assert.equal(entries[1].error.message, failure.message);
});
test("retains duplicate and contradictory event IDs without collapsing them", async () => {
  const world = {
    registerHandler() {},
    events: {
      list: async () => ({
        data: [
          { eventId: "same", correlationId: "a" },
          { eventId: "same", correlationId: "b" },
        ],
        hasMore: false,
      }),
    },
  };
  const observer = observeAdmissionWorld(world);
  const page = await world.events.list({ runId: "run" });
  assert.equal(page.data.length, 2);
  const events = observer.snapshot().entries.at(-1).output.events;
  assert.deepEqual(
    events.map(e => [e.eventId, e.correlationId]),
    [
      ["same", "a"],
      ["same", "b"],
    ],
  );
});

test("rejects redundant recovery, missing terminal replay and unknown delivery IDs", () => {
  const make = () => ({
    droppedEntries: 0,
    entries: ["world.start", "finish-hook", "terminal-replay"].flatMap((source, i) => [
      { operation: "queue", stage: "call", source, delivery: null, input: { runId: "run" } },
      { operation: "queue", stage: "return", output: { messageId: String(i) } },
      { operation: "handler", stage: "call", delivery: { messageId: String(i) } },
    ]),
  });
  assertRecoveryTrace(make(), "run");
  const redundant = make();
  redundant.entries.push(redundant.entries[0]);
  assert.throws(() => assertRecoveryTrace(redundant, "run"));
  const missing = make();
  missing.entries.splice(6);
  assert.throws(() => assertRecoveryTrace(missing, "run"));
  const unknown = make();
  unknown.entries[2].delivery.messageId = "unknown";
  assert.throws(() => assertRecoveryTrace(unknown, "run"));
});
