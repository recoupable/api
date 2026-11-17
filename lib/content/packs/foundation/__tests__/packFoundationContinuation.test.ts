import { expect, it } from "vitest";
import { getPackFoundationContinuation } from "../getPackFoundationContinuation";
import { createPackFoundationPlan } from "../createPackFoundationPlan";
import { foundationFixture } from "./foundationFixture";
import type { PackFoundationRecord } from "../packFoundationSchema";
it.each([
  ["in_flight", "waiting_for_existing_attempt", "get_pack"],
  ["uncertain", "needs_reconciliation", "get_pack_then_reconcile_or_resume_accepted_receipt"],
  ["failed", "needs_explicit_retry_approval", "get_pack_then_estimate_and_approve_failed_asset"],
  ["missing", "prerequisite_absent", "get_pack_then_reconcile_before_revision_or_new_pack"],
] as const)(
  "%s has a bounded existing continuation instead of a success-looking result",
  (reason, status, action) => {
    const snapshot = foundationFixture();
    snapshot.job.hold_expires_at = "2026-11-17T22:00:00Z";
    const record: PackFoundationRecord = {
      plan: createPackFoundationPlan(snapshot, { dependentAssetIds: ["video-0"] }),
      state: "unavailable",
      files: [],
      reason,
    };
    const result = getPackFoundationContinuation(
      record,
      snapshot.job,
      true,
      undefined,
      Date.parse("2026-11-17T21:00:00Z"),
    );
    expect(result.status).toBe(status);
    expect(result.action).toBe(action);
    expect(result.hold_expires_at).toBe("2026-11-17T22:00:00Z");
    expect(result.automatic_retry).toBe(false);
    expect(result.cancel_operation_available).toBe(false);
  },
);
it("none requested is an absent prerequisite, not a new funded artifact", () => {
  const snapshot = foundationFixture(0);
  const record: PackFoundationRecord = {
    plan: createPackFoundationPlan(snapshot, { dependentAssetIds: ["video-0"] }),
    state: "none_requested",
    files: [],
  };
  expect(getPackFoundationContinuation(record, snapshot.job, true).status).toBe(
    "prerequisite_absent",
  );
});
it("missing hold expiry never promises indefinite waiting and execution conflicts need reconciliation", () => {
  const snapshot = foundationFixture();
  const record: PackFoundationRecord = {
    plan: createPackFoundationPlan(snapshot, { dependentAssetIds: [] }),
    state: "unavailable",
    files: [],
    reason: "in_flight",
  };
  expect(getPackFoundationContinuation(record, snapshot.job, true).status).toBe(
    "needs_reconciliation",
  );
  expect(getPackFoundationContinuation(record, snapshot.job, false, "Hash changed").status).toBe(
    "needs_reconciliation",
  );
});
it("independent-only completed batch does not claim absent shared foundation acceptance", () => {
  const snapshot = foundationFixture(0);
  const record: PackFoundationRecord = {
    plan: createPackFoundationPlan(snapshot, { dependentAssetIds: [] }),
    state: "none_requested",
    files: [],
  };
  const result = getPackFoundationContinuation(record, snapshot.job, false);
  expect(result.status).toBe("batch_finished");
  expect(result.shared_foundation_ready).toBe(false);
});

it("expired holds require the existing read/reconciliation path", () => {
  const snapshot = foundationFixture();
  snapshot.job.hold_expires_at = "2026-11-17T20:00:00Z";
  const record: PackFoundationRecord = {
    plan: createPackFoundationPlan(snapshot, { dependentAssetIds: [] }),
    state: "unavailable",
    files: [],
    reason: "in_flight",
  };
  expect(
    getPackFoundationContinuation(
      record,
      snapshot.job,
      true,
      undefined,
      Date.parse("2026-11-17T21:00:00Z"),
    ).status,
  ).toBe("needs_reconciliation");
});
