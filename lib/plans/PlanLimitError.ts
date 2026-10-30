import type { PlanLimitBody } from "@/lib/plans/buildPlanLimitBody";

/**
 * Thrown by the task gate when a plan entitlement blocks a create or update.
 * Carries the documented REST body separately from the neutral MCP-facing reason.
 */
export class PlanLimitError extends Error {
  readonly body: PlanLimitBody;

  constructor(body: PlanLimitBody) {
    super("This task is unavailable with the account's current entitlements.");
    this.name = "PlanLimitError";
    this.body = body;
  }
}
