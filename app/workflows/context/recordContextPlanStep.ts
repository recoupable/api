import { recordBlockedContextPlan } from "@/lib/context/planning/recordBlockedContextPlan";

/** Opt-in until database PR77 is deployed; stores no runnable provider work. */
export async function recordContextPlanStep(actor: string, owner: string, requestId: string) {
  "use step";
  if (process.env.CONTEXT_RECORD_BLOCKED_PLAN_ENABLED !== "true") return null;
  return recordBlockedContextPlan(actor, owner, requestId);
}
