import assert from "node:assert/strict";
import { test } from "node:test";
import { assertOutcome } from "../assertOutcome.mjs";
function fixture() {
  const record = {
    state: "ready",
    plan: { digest: "plan" },
    asset_sha256: "asset",
    files: [{ sha256: "bytes" }],
    dependency_bindings: [{ asset_id: "video-0", attempt: 1 }],
  };
  const initial = {
    job: { held_credits: 10, quote: { id: "q" } },
    assets: [{ id: "video-0", attempt: 0 }],
  };
  const state = { ...structuredClone(initial), settlements: 1 };
  const trace = [
    { action: "prepare" },
    { action: "persist", result: record },
    {
      action: "produce",
      result: { assetId: "video-0", binding: { plan_sha256: "plan", asset_sha256: "asset" } },
    },
  ];
  const value = {
    status: "batch_finished",
    settlementDeferred: false,
    blockedAssetIds: [],
    continuation: { automatic_retry: false, new_budget_reserved: false },
    foundation: record,
  };
  return { initial, state, trace, value };
}
for (const [name, mutate] of [
  ["dependent dispatched before persisted readiness", f => f.trace.reverse()],
  ["dependent attempt binding missing", f => (f.trace[1].result.dependency_bindings = [])],
  ["accepted generation repeated", f => f.trace.push(f.trace[2])],
  ["unexpected new hold", f => f.state.job.held_credits++],
  [
    "readiness hash replaced",
    f => (f.value = { ...f.value, foundation: { ...f.value.foundation, asset_sha256: "other" } }),
  ],
])
  test(`rejects ${name}`, () => {
    const f = fixture();
    assertOutcome("success", f.initial, f.state, f.trace, f.value);
    mutate(f);
    assert.throws(() => assertOutcome("success", f.initial, f.state, f.trace, f.value));
  });
