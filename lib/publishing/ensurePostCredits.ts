import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { POST_CREDITS } from "@/lib/publishing/postCredits";

/**
 * Credit gate for a post, checked before the row is created. The matching
 * deduction happens in the workflow once the post is live, so a failed post
 * is free.
 *
 * @param accountId - Account being charged.
 * @returns A 402 NextResponse the handler returns directly, or null to proceed.
 */
export const ensurePostCredits = (accountId: string) =>
  ensureCreditsOrShortCircuit({ accountId, creditsToDeduct: POST_CREDITS });
