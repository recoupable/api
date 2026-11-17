import type { PackActor } from "../packTypes";
import type {
  PackAdmissionResult,
  PackAdmissionServices,
  PackAdmissionStart,
} from "./packAdmissionTypes";
/** Unwired engineering candidate: 30-second admission cutoff; scheduled poll interval at most 1 second. */
export async function pollPackAdmission(
  actor: PackActor,
  jobId: string,
  start: PackAdmissionStart,
  services: PackAdmissionServices,
): Promise<PackAdmissionResult> {
  const { read, sleepUntil } = services;
  const deadline = start.startedAt + 30_000;
  let originalExpiry: string | null = null;
  let previousTime = start.startedAt;
  const identity = () => ({
    job_id: jobId,
    workflow_run_id: start.workflowRunId,
    hold_expires_at: originalExpiry,
    deadline_at: deadline,
  });
  const reconcile = (
    reason: Extract<PackAdmissionResult, { status: "needs-reconciliation" }>["reason"],
  ): PackAdmissionResult => ({ ...identity(), status: "needs-reconciliation", reason });
  if (!Number.isFinite(start.startedAt) || !Number.isFinite(deadline))
    return reconcile("invalid-clock");
  if (!start.workflowRunId) return reconcile("different-run");
  while (true) {
    let observed;
    try {
      observed = await read(actor, jobId);
    } catch {
      return reconcile("read-failed");
    }
    const { job, observedAt, workflowRunId } = observed;
    if (!Number.isFinite(observedAt) || observedAt < previousTime)
      return reconcile("invalid-clock");
    previousTime = observedAt;
    if (
      job.id !== jobId ||
      typeof job.owner_id !== "string" ||
      job.owner_id.toLowerCase() !== (actor.organizationId ?? actor.accountId).toLowerCase()
    )
      return reconcile("scope");
    if (workflowRunId !== start.workflowRunId) return reconcile("different-run");
    if (job.status !== "running") return reconcile("not-running");
    const expiry = typeof job.hold_expires_at === "string" ? Date.parse(job.hold_expires_at) : NaN;
    if (!Number.isFinite(expiry)) return reconcile("invalid-hold");
    originalExpiry ??= job.hold_expires_at as string;
    const holdDeadline = Math.min(expiry, Date.parse(originalExpiry));
    if (holdDeadline <= observedAt) return reconcile("expired-hold");
    if (job.workflow_run_id != null && job.workflow_run_id !== start.workflowRunId)
      return reconcile("different-run");
    if (observedAt >= deadline) return reconcile("deadline");
    if (job.workflow_run_id === start.workflowRunId) return { ...identity(), status: "admitted" };
    try {
      await sleepUntil(new Date(Math.min(observedAt + 1000, deadline, holdDeadline)));
    } catch {
      return reconcile("wait-failed");
    }
  }
}
