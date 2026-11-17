import { AsyncLocalStorage } from "node:async_hooks";
/** Local SDK fixture only: correlate event loads with the delivery that replayed them. */
export function observeFailureDelivery(world) {
  const delivery = new AsyncLocalStorage();
  const observed = new Map();
  const create = world.events.create.bind(world.events);
  world.events.create = async (...args) => {
    const result = await create(...args);
    const current = delivery.getStore();
    // SDK runtime prefers the complete run_started event batch over events.list.
    if (current && args[1].eventType === "run_started" && result.events?.length)
      current.set(args[0], { events: [...result.events], complete: true, source: "run_started" });
    return result;
  };
  const list = world.events.list.bind(world.events);
  world.events.list = async (...args) => {
    const result = await list(...args);
    const current = delivery.getStore();
    if (current) {
      const runId = args[0].runId;
      const loaded = current.get(runId) ?? { events: [], complete: false, source: "events.list" };
      loaded.events.push(...result.data);
      loaded.complete = result.hasMore === false;
      current.set(runId, loaded);
    }
    return result;
  };
  return {
    hasObservedFailure: runId => observed.has(runId),
    failureEvidence: runId => observed.get(runId),
    deliver: async (handler, request) => {
      const current = new Map();
      const response = await delivery.run(current, () => handler(request));
      if (response.ok) {
        for (const [runId, loaded] of current) {
          if (!loaded.complete) continue;
          const steps = new Set(
            loaded.events
              .filter(
                e =>
                  e.eventType === "step_created" &&
                  e.eventData?.stepName === "step//./producePackAssetStep//producePackAssetStep",
              )
              .map(e => e.correlationId),
          );
          const failure = loaded.events.find(
            e =>
              e.eventType === "step_failed" &&
              steps.has(e.correlationId) &&
              (e.eventData?.error?.message ?? e.eventData?.error) ===
                'Step "step//./producePackAssetStep//producePackAssetStep" failed after 0 retries: Fixture claim acknowledgement lost',
          );
          if (failure)
            observed.set(runId, {
              runId,
              correlationId: failure.correlationId,
              eventId: failure.eventId,
              source: loaded.source,
              deliveryStatus: response.status,
            });
        }
      }
      return response;
    },
  };
}
