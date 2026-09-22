import type { CallToolResult } from "@/lib/mcp/getCallToolResult";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { checkCreditsAvailable } from "@/lib/credits/checkCreditsAvailable";
import { minimumCreditsForAnalyzeRequest } from "@/lib/flamingo/minimumCreditsForAnalyzeRequest";
import { assertAnalyzeWithinPlan } from "@/lib/plans/assertAnalyzeWithinPlan";
import { PlanLimitError } from "@/lib/plans/PlanLimitError";
import type { FlamingoGenerateBody } from "@/lib/flamingo/flamingoGenerateBodySchema";

/**
 * The two gates the `analyze_music` MCP tool runs before the model, in the
 * same order as the HTTP handler: the plan's monthly analyze cap, then the
 * credit balance on the base price. Each failure comes back as a tool error
 * naming its own step; null means both passed.
 *
 * @param accountId - The account the analysis would be charged to.
 * @param args - The validated tool arguments.
 * @returns A tool error to return to the caller, or null to proceed.
 */
export async function gateAnalyzeForTool(
  accountId: string,
  args: FlamingoGenerateBody,
): Promise<CallToolResult | null> {
  try {
    await assertAnalyzeWithinPlan({ accountId, audioUrl: args.audio_url });
  } catch (err) {
    if (err instanceof PlanLimitError) return getToolResultError(err.message);
    console.error("[analyze_music] plan gate failed:", err);
    return getToolResultError("Plan check failed");
  }

  let gate;
  try {
    gate = await checkCreditsAvailable({
      accountId,
      creditsToDeduct: minimumCreditsForAnalyzeRequest(args),
    });
  } catch (err) {
    console.error("[analyze_music] credit gate failed:", err);
    return getToolResultError("Credit check failed");
  }
  if (gate.kind === "insufficient_credits") {
    return getToolResultError(
      `Insufficient credits: ${gate.remainingCredits} remaining, ${gate.requiredCredits} required`,
    );
  }
  return null;
}
