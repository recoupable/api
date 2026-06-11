import { describe, it, expect, vi, beforeEach } from "vitest";
import { deductCredits } from "../deductCredits";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";

vi.mock("@/lib/credits/recordCreditDeduction", () => ({ recordCreditDeduction: vi.fn() }));

describe("deductCredits", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deducts the research credit cost", async () => {
    await deductCredits("acc_1");

    expect(recordCreditDeduction).toHaveBeenCalledWith({
      accountId: "acc_1",
      creditsToDeduct: 5,
      source: "api",
    });
  });

  it("never throws when the deduction fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(recordCreditDeduction).mockRejectedValue(new Error("billing down"));

    await expect(deductCredits("acc_1")).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
