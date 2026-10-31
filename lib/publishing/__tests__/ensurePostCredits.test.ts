import { describe, it, expect, vi } from "vitest";
import { ensurePostCredits } from "../ensurePostCredits";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";

vi.mock("@/lib/credits/ensureCreditsOrShortCircuit", () => ({
  ensureCreditsOrShortCircuit: vi.fn(),
}));

describe("ensurePostCredits", () => {
  it("gates on one post's price for the account", async () => {
    vi.mocked(ensureCreditsOrShortCircuit).mockResolvedValue(null);
    expect(await ensurePostCredits("acct")).toBeNull();
    expect(ensureCreditsOrShortCircuit).toHaveBeenCalledWith({
      accountId: "acct",
      creditsToDeduct: 10_000,
    });
  });
});
