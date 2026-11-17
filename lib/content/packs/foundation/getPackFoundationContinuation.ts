import type { PackJob } from "../packTypes";
import type { PackFoundationRecord } from "./packFoundationSchema";
/** Describe existing owner actions; never initiate retries, refunds or a new hold. */
export function getPackFoundationContinuation(
  record: PackFoundationRecord | undefined,
  job: PackJob | undefined,
  deferred: boolean,
  error?: string,
  nowMs = Date.now(),
) {
  const expiry =
    typeof job?.hold_expires_at === "string" && Number.isFinite(Date.parse(job.hold_expires_at))
      ? job.hold_expires_at
      : null;
  let status = "batch_finished";
  let action = "get_pack";
  if (record?.blocked_reason === "reference_limit") {
    status = "needs_reference_selection";
    action = "get_pack_then_reconcile_hold_and_choose_reference_scope_for_new_quote_or_pack";
  } else if (error || !record) {
    status = "needs_reconciliation";
    action = "get_pack_then_reconcile_saved_state";
  } else if (deferred) {
    if (record.state === "none_requested" || record.reason === "missing") {
      status = "prerequisite_absent";
      action = "get_pack_then_reconcile_before_revision_or_new_pack";
    } else if (record.reason === "failed") {
      status = "needs_explicit_retry_approval";
      action = "get_pack_then_estimate_and_approve_failed_asset";
    } else if (record.reason === "not_usable") {
      status = "needs_reconciliation";
      action = "get_pack_then_reconcile_saved_state";
    } else if (record.reason === "uncertain") {
      status = "needs_reconciliation";
      action = "get_pack_then_reconcile_or_resume_accepted_receipt";
    } else if (expiry && Date.parse(expiry) > nowMs) {
      status = "waiting_for_existing_attempt";
    } else {
      status = "needs_reconciliation";
      action = "get_pack_then_reconcile_saved_state";
    }
  }
  return {
    status,
    action,
    job_id: job?.id ?? record?.plan.job_id ?? null,
    foundation_asset_id: record?.plan.asset_id ?? null,
    shared_foundation_ready: record?.state === "ready",
    hold_expires_at: expiry,
    automatic_retry: false as const,
    new_budget_reserved: false as const,
    cancel_operation_available: false as const,
    hold_recovery: deferred
      ? "Existing get/read reconciles an expired running hold; this candidate neither renews nor releases it. Missing expiry requires owner reconciliation."
      : "Existing settlement path invoked after admitted work drained.",
    continuation_boundary:
      "Failed-asset retry requires fresh estimate and explicit approval. Uncertain receipt resume requires an accepted request ID and saved route; otherwise reconcile manually. This candidate accepts only the original full quote and does not automatically resume after a retry quote or revision. No cancel endpoint exists; funded/produced brief edits remain rejected by existing persistence.",
  };
}
