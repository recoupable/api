import assert from "node:assert/strict";
import { test } from "node:test";
import { observeFailureDelivery } from "../observeFailureDelivery.mjs";
const created = {
  eventType: "step_created",
  correlationId: "step-2",
  eventData: { stepName: "step//./producePackAssetStep//producePackAssetStep" },
};
const failed = {
  eventType: "step_failed",
  correlationId: "step-2",
  eventData: {
    error: {
      message:
        'Step "step//./producePackAssetStep//producePackAssetStep" failed after 0 retries: Fixture claim acknowledgement lost',
    },
  },
};
function fixture(data = [created, failed], hasMore = false) {
  const world = { events: { create: async () => ({}), list: async () => ({ data, hasMore }) } };
  return { world, observer: observeFailureDelivery(world) };
}
test("claim trace or a journal read outside delivery cannot open the barrier", async () => {
  const { world, observer } = fixture();
  await world.events.list({ runId: "run" });
  await observer.deliver(async () => new Response(), {});
  assert.equal(observer.hasObservedFailure("run"), false);
});
test("only a successful completed delivery loading the matching failed step opens the barrier", async () => {
  const { world, observer } = fixture();
  let finish;
  const waiting = new Promise(resolve => {
    finish = resolve;
  });
  const delivery = observer.deliver(async () => {
    await world.events.list({ runId: "run" });
    await waiting;
    return new Response();
  }, {});
  await Promise.resolve();
  assert.equal(observer.hasObservedFailure("run"), false);
  finish();
  await delivery;
  assert.equal(observer.hasObservedFailure("run"), true);
  assert.equal(observer.hasObservedFailure("other-run"), false);
});
for (const [label, data, hasMore, status] of [
  ["missing creation", [failed], false, 200],
  ["different step", [{ ...created, correlationId: "other" }, failed], false, 200],
  ["different function", [{ ...created, eventData: { stepName: "other" } }, failed], false, 200],
  ["different failure", [created, { ...failed, eventData: { error: "other" } }], false, 200],
  ["incomplete event load", [created, failed], true, 200],
  ["failed handler", [created, failed], false, 500],
])
  test(`${label} cannot open the barrier`, async () => {
    const { world, observer } = fixture(data, hasMore);
    await observer.deliver(async () => {
      await world.events.list({ runId: "run" });
      return new Response(null, { status });
    }, {});
    assert.equal(observer.hasObservedFailure("run"), false);
  });
test("events from concurrent deliveries cannot be combined", async () => {
  let calls = 0;
  const world = {
    events: {
      create: async () => ({}),
      list: async () => ({ data: calls++ ? [failed] : [created], hasMore: false }),
    },
  };
  const observer = observeFailureDelivery(world);
  await Promise.all(
    [1, 2].map(() =>
      observer.deliver(async () => {
        await world.events.list({ runId: "run" });
        return new Response();
      }, {}),
    ),
  );
  assert.equal(observer.hasObservedFailure("run"), false);
});

test("run_started preloaded events count only inside a successful completed delivery", async () => {
  const world = {
    events: {
      list: async () => {
        throw new Error("unexpected fallback");
      },
      create: async () => ({ run: { runId: "run" }, events: [created, failed] }),
    },
  };
  const observer = observeFailureDelivery(world);
  await world.events.create("run", { eventType: "run_started" });
  assert.equal(observer.hasObservedFailure("run"), false);
  await observer.deliver(async () => {
    await world.events.create("run", { eventType: "step_started" });
    return new Response();
  }, {});
  assert.equal(observer.hasObservedFailure("run"), false);
  await observer.deliver(async () => {
    await world.events.create("run", { eventType: "run_started" });
    return new Response(null, { status: 500 });
  }, {});
  assert.equal(observer.hasObservedFailure("run"), false);
  await observer.deliver(async () => {
    await world.events.create("run", { eventType: "run_started" });
    return new Response();
  }, {});
  assert.equal(observer.hasObservedFailure("run"), true);
});

test("complete paginated event load correlates across pages in one delivery", async () => {
  let page = 0;
  const world = {
    events: {
      create: async () => ({}),
      list: async () =>
        ++page === 1 ? { data: [created], hasMore: true } : { data: [failed], hasMore: false },
    },
  };
  const observer = observeFailureDelivery(world);
  await observer.deliver(async () => {
    await world.events.list({ runId: "run" });
    await world.events.list({ runId: "run" });
    return new Response();
  }, {});
  assert.equal(observer.hasObservedFailure("run"), true);
});
