import { usdToCredits } from "@/lib/credits/usdToCredits";

/**
 * What one post costs: $0.01 (decision 2026-10-18, recoupable/app#2241),
 * charged only once the post reaches `posted`.
 */
export const POST_CREDITS = usdToCredits(0.01);
