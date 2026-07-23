import { NextResponse } from "next/server";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { alertCreditShortfall } from "@/lib/credits/alertCreditShortfall";
import { CREDIT_AUTO_RECHARGE_FALLBACK_SUCCESS_URL } from "@/lib/credits/const";

/**
 * Minimum credit balance required before an agent run is allowed to start.
 * A 1-credit floor turns the "charge after the run" model into "don't start a
 * run for an account that's already out of credits (and can't auto-recharge)".
 * Accounts with a saved card top up transparently inside the gate; burners with
 * no card are stopped here instead of draining into a deep negative balance
 * (recoupable/chat#1885 — WAVS Digital hit -1,563).
 */
const SCHEDULED_RUN_MIN_CREDITS = 1;

export type GateWorkflowCreditsParams = {
  accountId: string;
  chatId: string;
  sessionId: string;
};

export type GateWorkflowCreditsResult = {
  /** True when the run may proceed; false when it should be skipped. */
  hasCredits: boolean;
};

/**
 * Pre-run credit gate for `runAgentWorkflow`, run as a `"use step"` so its DB /
 * Stripe I/O is legal inside the durable workflow and cached across replays.
 *
 * Reuses the request-path gate (`ensureCreditsOrShortCircuit`, which attempts a
 * silent auto-recharge) so scheduled runs enforce the same credit rules as
 * `/api/research` and the social-scrape routes. On shortfall it fires a
 * Telegram alert to the team and returns `hasCredits:false` so the caller skips
 * the run before any model tokens are spent.
 *
 * Fails OPEN: if the credit check itself throws (transient Stripe/Supabase
 * error), we let the run proceed rather than break every run on an infra blip —
 * the post-run charge still applies.
 */
export async function gateWorkflowCredits(
  params: GateWorkflowCreditsParams,
): Promise<GateWorkflowCreditsResult> {
  "use step";

  const { accountId, chatId, sessionId } = params;

  try {
    const short = await ensureCreditsOrShortCircuit({
      accountId,
      creditsToDeduct: SCHEDULED_RUN_MIN_CREDITS,
      successUrl: CREDIT_AUTO_RECHARGE_FALLBACK_SUCCESS_URL,
    });

    if (short instanceof NextResponse) {
      console.warn("[gateWorkflowCredits] insufficient credits, skipping run", {
        accountId,
        chatId,
        sessionId,
      });
      await alertCreditShortfall({ accountId, chatId, sessionId });
      return { hasCredits: false };
    }

    return { hasCredits: true };
  } catch (error) {
    console.error("[gateWorkflowCredits] credit check failed, proceeding (fail-open):", error);
    return { hasCredits: true };
  }
}
