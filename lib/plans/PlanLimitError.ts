import type { PlanLimitBody } from "@/lib/plans/buildPlanLimitBody";

/**
 * Thrown by the task gate when a plan entitlement blocks a create or update.
 * Carries the documented 402 body; `message` is the human line so MCP callers
 * that only see the message still read the reason.
 */
export class PlanLimitError extends Error {
  readonly body: PlanLimitBody;

  constructor(body: PlanLimitBody) {
    super(body.message);
    this.name = "PlanLimitError";
    this.body = body;
  }
}
