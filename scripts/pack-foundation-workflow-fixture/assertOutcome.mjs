import assert from "node:assert/strict";
export function assertOutcome(scenario, initial, state, trace, value) {
  const ready = ["success", "retained"].includes(scenario);
  const produced = trace.filter(e => e.action === "produce");
  const expectedIds = {
    success: ["artwork-0", "video-0", "quote_card-0"],
    retained: ["video-0"],
    failed: ["artwork-0", "quote_card-0"],
    uncertain: ["artwork-0", "quote_card-0"],
    none_requested: ["quote_card-0"],
    missing: ["quote_card-0"],
    "persistence-ack-loss": ["artwork-0"],
  }[scenario];
  assert.deepEqual(produced.map(e => e.result.assetId).sort(), [...expectedIds].sort());
  for (const event of produced) {
    const expectedStatus =
      event.result.assetId === "artwork-0" && ["failed", "uncertain"].includes(scenario)
        ? scenario
        : "completed";
    const asset = state.assets.find(a => a.id === event.result.assetId);
    assert.equal(event.result.status, expectedStatus);
    assert.equal(asset?.status, expectedStatus);
    assert.equal(asset?.attempt, 1);
  }
  assert.equal(new Set(produced.map(e => e.result.assetId)).size, produced.length);
  assert.equal(trace.filter(e => e.action === "prepare").length, 1);
  assert.equal(state.job.held_credits, initial.job.held_credits);
  assert.deepEqual(state.job.quote, initial.job.quote);
  assert.equal(state.assets.length, initial.assets.length);
  assert(state.assets.every(a => a.attempt <= 1));
  if (scenario === "persistence-ack-loss") {
    assert.equal(state.settlements, 0);
    assert.equal(value.settlementDeferred, true);
    assert.equal(value.status, "needs_reconciliation");
    assert.match(value.error, /inspect saved status/);
    assert.equal(state.job.production_context.shared_foundation.state, "ready");
    assert.deepEqual(
      produced.map(e => e.result.assetId),
      ["artwork-0"],
    );
    return;
  }
  assert.equal(state.settlements, ready ? 1 : 0);
  assert.equal(value.settlementDeferred, !ready);
  assert.deepEqual(value.blockedAssetIds, ready ? [] : ["video-0"]);
  assert.equal(value.continuation.automatic_retry, false);
  assert.equal(value.continuation.new_budget_reserved, false);
  const statuses = {
    success: "batch_finished",
    retained: "batch_finished",
    failed: "needs_explicit_retry_approval",
    uncertain: "needs_reconciliation",
    none_requested: "prerequisite_absent",
    missing: "prerequisite_absent",
  };
  assert.equal(value.status, statuses[scenario]);
  if (ready) {
    const persisted = trace.findIndex(e => e.action === "persist" && e.result.state === "ready");
    const dispatch = trace.findIndex(e => e.action === "produce" && e.result.assetId === "video-0");
    assert(
      persisted >= 0 && dispatch > persisted,
      "readiness must persist before dependent dispatch",
    );
    const record = trace[persisted].result;
    assert.deepEqual(record.dependency_bindings, [{ asset_id: "video-0", attempt: 1 }]);
    assert.deepEqual(trace[dispatch].result.binding, {
      plan_sha256: record.plan.digest,
      asset_sha256: record.asset_sha256,
    });
    assert.equal(value.foundation.asset_sha256, record.asset_sha256);
    assert.equal(value.foundation.files[0].sha256, record.files[0].sha256);
  } else {
    assert(!produced.some(e => e.result.assetId === "video-0"));
    assert.equal(state.assets.find(a => a.id === "video-0").status, "pending");
    assert(
      produced.some(e => e.result.assetId === "quote_card-0"),
      "independent asset must remain eligible",
    );
    assert.equal(
      value.foundation.state,
      scenario === "none_requested" ? "none_requested" : "unavailable",
    );
    if (scenario !== "none_requested") assert.equal(value.foundation.reason, scenario);
  }
  if (scenario === "retained") {
    assert.deepEqual(
      produced.map(e => e.result.assetId),
      ["video-0"],
    );
    for (const a of initial.assets.filter(a => a.status === "completed"))
      assert.deepEqual(
        state.assets.find(b => b.id === a.id),
        a,
      );
    assert.deepEqual(value.foundation, initial.job.production_context.shared_foundation);
  }
}
