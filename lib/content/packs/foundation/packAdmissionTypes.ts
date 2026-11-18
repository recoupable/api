import type { PackActor, PackJob } from "../packTypes";
export type PackAdmissionStart = { workflowRunId: string; startedAt: number };
export type PackAdmissionObservation = {
  workflowRunId: string;
  observedAt: number;
  job: Pick<PackJob, "id" | "owner_id" | "status" | "workflow_run_id"> & {
    hold_expires_at: unknown;
  };
};
export type PackAdmissionServices = {
  read: (actor: PackActor, jobId: string) => Promise<PackAdmissionObservation>;
  sleepUntil: (date: Date) => Promise<void>;
};
export type PackAdmissionResult = {
  job_id: string;
  workflow_run_id: string;
  deadline_at: number;
} & (
  | { status: "admitted"; hold_expires_at: string }
  | {
      status: "needs-reconciliation";
      hold_expires_at: string | null;
      reason:
        | "scope"
        | "different-run"
        | "not-running"
        | "invalid-hold"
        | "expired-hold"
        | "deadline"
        | "read-failed"
        | "wait-failed"
        | "invalid-clock";
    }
);
