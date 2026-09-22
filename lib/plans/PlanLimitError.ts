import type { PlanLimitBody } from "@/lib/plans/buildPlanLimitBody";
import type { AnalyzePlanLimitBody } from "@/lib/plans/buildAnalyzePlanLimitBody";

/**
 * Thrown by the task gate and the analyze gate when a plan entitlement blocks
 * the request. Carries the documented 402 body; `message` is the human line so
 * MCP callers that only see the message still read the reason.
 */
export class PlanLimitError extends Error {
  readonly body: PlanLimitBody | AnalyzePlanLimitBody;

  constructor(body: PlanLimitBody | AnalyzePlanLimitBody) {
    super(body.message);
    this.name = "PlanLimitError";
    this.body = body;
  }
}
