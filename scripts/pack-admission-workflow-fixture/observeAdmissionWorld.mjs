import { AsyncLocalStorage } from "node:async_hooks";
import { appendFile } from "node:fs/promises";
/** Passive, in-memory tracing: no sleeps, locks, retries, body reads or altered SDK results. */
export function observeAdmissionWorld(world, options = {}) {
  const deliveries = new AsyncLocalStorage();
  const sources = new AsyncLocalStorage();
  let pending = Promise.resolve();
  let persistenceError;
  let droppedEntries = 0;
  let traceBytes = 0;
  const trace = [];
  let nextOperation = 0;
  let nextDelivery = 0;
  const record = entry => {
    if (trace.length >= 20000) {
      droppedEntries++;
      return;
    }
    const item = {
      sequence: trace.length,
      at: Date.now(),
      pid: process.pid,
      phase: options.phase,
      source: sources.getStore() ?? "external",
      ...entry,
    };
    const line = JSON.stringify(item) + "\n";
    const bytes = Buffer.byteLength(line);
    if (traceBytes + bytes > 2097152) {
      droppedEntries++;
      return;
    }
    traceBytes += bytes;
    trace.push(item);
    if (options.outputPath)
      pending = pending
        .then(() => (options.writeLine ?? appendFile)(options.outputPath, line))
        .catch(error => {
          persistenceError = error.message;
        });
  };
  const event = e =>
    e && {
      eventId: e.eventId,
      eventType: e.eventType,
      correlationId: e.correlationId,
      createdAt: e.createdAt,
      resumeAt: e.eventData?.resumeAt,
      stepName: e.eventData?.stepName,
    };
  const observe = (operation, input, invoke, project) => {
    const operationId = ++nextOperation;
    const delivery = deliveries.getStore() ?? null;
    record({ operationId, delivery, operation, stage: "call", input });
    try {
      const result = invoke();
      result
        .then(
          value =>
            record({ operationId, delivery, operation, stage: "return", output: project(value) }),
          error =>
            record({
              operationId,
              delivery,
              operation,
              stage: "reject",
              error: { name: error.name, message: error.message },
            }),
        )
        .catch(error =>
          record({ operationId, operation, stage: "observer-error", error: error.message }),
        );
      return result;
    } catch (error) {
      record({
        operationId,
        delivery,
        operation,
        stage: "throw",
        error: { name: error.name, message: error.message },
      });
      throw error;
    }
  };
  const register = world.registerHandler;
  world.registerHandler = function (prefix, handler) {
    return register.call(this, prefix, function (...args) {
      const req = args[0];
      const delivery = {
        deliveryId: ++nextDelivery,
        source: sources.getStore() ?? "external",
        prefix,
        queueName: req.headers.get("x-vqs-queue-name"),
        messageId: req.headers.get("x-vqs-message-id"),
        attempt: req.headers.get("x-vqs-message-attempt"),
      };
      return deliveries.run(delivery, () =>
        observe(
          "handler",
          { prefix },
          () => handler.apply(this, args),
          response => ({ status: response.status }),
        ),
      );
    });
  };
  for (const method of ["create", "list", "listByCorrelationId"]) {
    const original = world.events[method];
    if (!original) continue;
    world.events[method] = function (...args) {
      const input =
        method === "create"
          ? { runId: args[0], event: event(args[1]) }
          : { ...args[0], pagination: args[0]?.pagination && { ...args[0].pagination } };
      return observe(
        `events.${method}`,
        input,
        () => original.apply(this, args),
        result =>
          method === "create"
            ? {
                event: event(result.event),
                waitId: result.wait?.waitId,
                preloadedEvents: result.events?.map(event),
              }
            : { cursor: result.cursor, hasMore: result.hasMore, events: result.data.map(event) },
      );
    };
  }
  const observeQueue = (queue, args) =>
    observe(
      "queue",
      {
        queueName: args[0],
        runId: args[1]?.runId ?? args[1]?.workflowRunId,
        stepId: args[1]?.stepId,
        idempotencyKey: args[2]?.idempotencyKey,
      },
      () => queue(...args),
      value => ({ messageId: value.messageId }),
    );
  record({
    operation: "observer",
    stage: "installed",
    schema: 1,
    sdk: globalThis[Symbol.for("pack.admission.sdk")],
    sourceHead: process.env.PACK_ADMISSION_SOURCE_HEAD ?? "unbound",
  });
  const snapshot = () => ({
    entries: structuredClone(trace),
    traceBytes,
    droppedEntries,
    persistenceError,
  });
  return {
    snapshot,
    flush: async () => {
      for (;;) {
        const draining = pending;
        await draining;
        if (draining === pending) return snapshot();
      }
    },
    observeQueue,
    source: (label, invoke) => sources.run(label, () => observe(label, {}, invoke, () => ({}))),
  };
}
