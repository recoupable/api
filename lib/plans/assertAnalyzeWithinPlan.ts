import { getAccountSubscriptionState } from "@/lib/credits/getAccountSubscriptionState";
import { countAnalyzedTracksSince } from "@/lib/supabase/usage_events/countAnalyzedTracksSince";
import { getPlanEntitlements } from "@/lib/plans/getPlanEntitlements";
import { getCalendarMonthStart } from "@/lib/plans/getCalendarMonthStart";
import { buildAnalyzePlanLimitBody } from "@/lib/plans/buildAnalyzePlanLimitBody";
import { PlanLimitError } from "@/lib/plans/PlanLimitError";

/**
 * The analyze gate for POST /api/songs/analyze and the `analyze_music` MCP
 * tool (recoupable/app#2061): resolves the account's plan and, on a capped
 * plan, counts the distinct tracks analyzed since the first of the UTC month.
 * Throws {@link PlanLimitError} with the documented body when the cap is
 * reached. Runs before the credit gate and before any Modal call, so a
 * blocked request costs nothing.
 *
 * @param accountId - The account the analysis would be charged to.
 */
export async function assertAnalyzeWithinPlan(args: { accountId: string }): Promise<void> {
  const { accountId } = args;
  const { plan } = await getAccountSubscriptionState(accountId);
  const { analyze_limit } = getPlanEntitlements(plan);
  if (analyze_limit === null) return;

  const currentAnalyzeCount = await countAnalyzedTracksSince({
    accountId,
    since: getCalendarMonthStart(),
  });
  if (currentAnalyzeCount >= analyze_limit) {
    throw new PlanLimitError(buildAnalyzePlanLimitBody({ plan, currentAnalyzeCount }));
  }
}
