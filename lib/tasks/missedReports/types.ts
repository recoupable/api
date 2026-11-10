import type { Tables } from "@/types/database.types";

/** A run of the scheduled `customer-prompt-task`, resolved to the task it ran. */
export interface ScheduledReportRun {
  runId: string;
  /** `scheduled_actions.id`, the schedule's external id. */
  taskId: string;
  createdAt: string;
  /** Trigger.dev run status, e.g. COMPLETED or FAILED. */
  status: string;
}

/**
 * Why a scheduled run sent no email: the plan blocked the task, the send
 * reached POST /api/emails and was refused, or no send was attempted.
 */
export type MissedReportCause = "plan_blocked" | "email_rejected" | "no_email";

export interface MissedReport {
  task: Tables<"scheduled_actions">;
  run: ScheduledReportRun;
  cause: MissedReportCause;
  /** The plan message, the latest rejection reason, or the run status. */
  detail: string;
  /** Where to upgrade, when the plan blocked the task. */
  billingUrl?: string;
}

export interface NotifiedMissedReport extends MissedReport {
  customerNotified: boolean;
}
