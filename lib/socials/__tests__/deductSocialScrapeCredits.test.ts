import { describe, it, expect, vi, beforeEach } from "vitest";

import { deductSocialScrapeCredits } from "../deductSocialScrapeCredits";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";

vi.mock("@/lib/credits/recordCreditDeduction", () => ({ recordCreditDeduction: vi.fn() }));

const ACCOUNT_ID = "770e8400-e29b-41d4-a716-446655440000";

describe("deductSocialScrapeCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records the deduction with the given credits", async () => {
    await deductSocialScrapeCredits(ACCOUNT_ID, 25);
    expect(recordCreditDeduction).toHaveBeenCalledWith({
      accountId: ACCOUNT_ID,
      creditsToDeduct: 25,
      source: "api",
    });
  });

  it("never throws when the deduction fails (billing must not fail a started scrape)", async () => {
    vi.mocked(recordCreditDeduction).mockRejectedValue(new Error("db down"));
    await expect(deductSocialScrapeCredits(ACCOUNT_ID, 5)).resolves.toBeUndefined();
  });
});
