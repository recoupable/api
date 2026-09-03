import { describe, it, expect, vi, afterEach } from "vitest";

const getFalBillableUnits = vi.fn();
const deductCredits = vi.fn();

vi.mock("@/lib/fal/getFalBillableUnits", () => ({ getFalBillableUnits }));
vi.mock("@/lib/credits/deductCredits", () => ({ deductCredits }));

const { chargeForGeneration } = await import("@/lib/content/chargeForGeneration");

afterEach(() => vi.clearAllMocks());

describe("chargeForGeneration", () => {
  it("deducts credits computed from fal's real billable units when available", async () => {
    getFalBillableUnits.mockResolvedValue(8);
    deductCredits.mockResolvedValue({ success: true, newBalance: 100 });

    await chargeForGeneration({
      accountId: "acc-1",
      endpointId: "minimax/h3-max/image-to-video",
      requestId: "req-1",
      fallbackUnits: 5,
      creditsForUnits: units => units * 1000,
    });

    expect(deductCredits).toHaveBeenCalledWith({ accountId: "acc-1", creditsToDeduct: 8000 });
  });

  it("falls back to the estimate when the real unit count is unavailable", async () => {
    getFalBillableUnits.mockResolvedValue(null);
    deductCredits.mockResolvedValue({ success: true, newBalance: 100 });

    await chargeForGeneration({
      accountId: "acc-1",
      endpointId: "meta/muse-image/text-to-image",
      requestId: "req-2",
      fallbackUnits: 3,
      creditsForUnits: units => units * 1000,
    });

    expect(deductCredits).toHaveBeenCalledWith({ accountId: "acc-1", creditsToDeduct: 3000 });
  });

  it("logs and swallows a deduction failure instead of throwing — fal has already been paid", async () => {
    getFalBillableUnits.mockResolvedValue(1);
    deductCredits.mockRejectedValue(new Error("insufficient"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      chargeForGeneration({
        accountId: "acc-1",
        endpointId: "meta/muse-image/text-to-image",
        requestId: "req-3",
        fallbackUnits: 1,
        creditsForUnits: units => units * 1000,
      }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
  });
});
