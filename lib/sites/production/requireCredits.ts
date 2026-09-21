import { checkCreditsAvailable } from "@/lib/credits/checkCreditsAvailable";
import { SiteError } from "../SiteError";
export async function requireCredits(accountId: string, creditsToDeduct = 1) {
  const result = await checkCreditsAvailable({ accountId, creditsToDeduct });
  if (result.kind !== "available")
    throw new SiteError(402, "Not enough credits to continue site production.");
}
