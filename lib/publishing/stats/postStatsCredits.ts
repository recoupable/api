import { usdToCredits } from "@/lib/credits/usdToCredits";

/** One post stats read costs $0.001, charged to the caller after a successful read. */
export const POST_STATS_CREDITS = usdToCredits(0.001);
