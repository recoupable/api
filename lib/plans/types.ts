/** The three plans an account can be on. Resolved from Stripe, never stored. */
export type Plan = "free" | "starter" | "pro";

/** What a plan lets an account do; the single table behind credits and the task gate. */
export interface PlanEntitlements {
  /** Monthly credit allotment in dollars. */
  credits_usd: number;
  /** Maximum enabled scheduled tasks; null means uncapped. */
  task_limit: number | null;
  /** Shortest allowed gap between two consecutive runs of a task, in minutes. */
  min_cadence_minutes: number;
}

/** Which entitlement a task request violated. */
export type PlanLimit = "task_count" | "min_cadence";
