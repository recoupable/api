import { describe, it, expect, vi } from "vitest";
import { chargePostStatsRead } from "../chargePostStatsRead";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";
import { POST_STATS_CREDITS } from "@/lib/publishing/stats/postStatsCredits";

vi.mock("@/lib/credits/recordCreditDeduction", () => ({
  recordCreditDeduction: vi.fn().mockResolvedValue({ success: true }),
}));

describe("chargePostStatsRead", () => {
  it("records the read like a post: composio provider, per-platform model id, the post url", async () => {
    await chargePostStatsRead(
      "acct",
      "linkedin",
      "https://www.linkedin.com/feed/update/urn:li:ugcPost:1/",
    );
    expect(recordCreditDeduction).toHaveBeenCalledWith({
      accountId: "acct",
      creditsToDeduct: POST_STATS_CREDITS,
      source: "api",
      provider: "composio",
      modelId: "posts/linkedin/stats",
      resourceUrl: "https://www.linkedin.com/feed/update/urn:li:ugcPost:1/",
    });
  });
});
