import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { creditCostForDuration } from "@/lib/music/creditCostForDuration";

/**
 * Credit gate for music generation.
 *
 * Checked before fal is called, so an account without credits never spends our
 * money. The matching deduction happens in the workflow once the audio is
 * stored, which is why a failed generation is free.
 *
 * @param accountId - Account being charged.
 * @param requestedDurationSeconds - Length the caller asked for.
 * @returns A 402 NextResponse the handler returns directly, or null to proceed.
 */
export const ensureMusicCredits = (accountId: string, requestedDurationSeconds: number) =>
  ensureCreditsOrShortCircuit({
    accountId,
    creditsToDeduct: creditCostForDuration(requestedDurationSeconds),
  });
