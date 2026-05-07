/**
 * Lifecycle FSM states stored as `lifecycle_state` on the `sessions`
 * row. The workflow transitions through these as it pauses, restores,
 * and recovers from failure.
 */
export type SandboxLifecycleState =
  | "provisioning"
  | "active"
  | "hibernating"
  | "hibernated"
  | "restoring"
  | "archived"
  | "failed";

/**
 * Reason the lifecycle workflow was kicked. Each callsite passes a
 * specific value so observability can trace which path triggered an
 * evaluation. Mirrored from open-agents — extend / snapshot reasons
 * are listed for parity even though those endpoints aren't ported yet.
 */
export type SandboxLifecycleReason =
  | "sandbox-created"
  | "timeout-extended"
  | "snapshot-restored"
  | "reconnect"
  | "manual-stop"
  | "status-check-overdue";

/**
 * Result of a single lifecycle evaluation pass — what the workflow
 * returns to the kick caller for logging.
 */
export interface SandboxLifecycleEvaluationResult {
  action: "skipped" | "hibernated" | "failed";
  reason?: string;
}
