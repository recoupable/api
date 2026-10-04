import { getAccountSubscriptionState } from "@/lib/credits/getAccountSubscriptionState";
import { selectAnalyzedTrackUrlsSince } from "@/lib/supabase/usage_events/selectAnalyzedTrackUrlsSince";
import { getPlanEntitlements } from "@/lib/plans/getPlanEntitlements";
import { getCalendarMonthStart } from "@/lib/plans/getCalendarMonthStart";
import { buildAnalyzePlanLimitBody } from "@/lib/plans/buildAnalyzePlanLimitBody";
import { PlanLimitError } from "@/lib/plans/PlanLimitError";

/**
 * The analyze gate for POST /api/songs/analyze and the `analyze_music` MCP
 * tool (recoupable/app#2061): resolves the account's plan and, on a capped
 * plan, lists the distinct tracks analyzed since the first of the UTC month.
 * A track already on that list is always allowed (a repeat costs credits but
 * no slot); a new track past the cap throws {@link PlanLimitError} with the
 * documented body. Runs before the credit gate and before any Modal call, so
 * a blocked request costs nothing.
 *
 * @param accountId - The account the analysis would be charged to.
 * @param audioUrl - The track about to be analyzed.
 */
export async function assertAnalyzeWithinPlan(args: {
  accountId: string;
  audioUrl: string;
}): Promise<void> {
  const { accountId, audioUrl } = args;
  const { plan } = await getAccountSubscriptionState(accountId);
  const { analyze_limit } = getPlanEntitlements(plan);
  if (analyze_limit === null) return;

  const analyzed = await selectAnalyzedTrackUrlsSince({
    accountId,
    since: getCalendarMonthStart(),
  });
  if (analyzed.includes(audioUrl)) return;
  if (analyzed.length >= analyze_limit) {
    throw new PlanLimitError(
      buildAnalyzePlanLimitBody({ plan, currentAnalyzeCount: analyzed.length }),
    );
  }
}
