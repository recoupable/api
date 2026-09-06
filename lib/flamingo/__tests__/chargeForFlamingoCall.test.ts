import { describe, it, expect, vi, beforeEach } from "vitest";
import { chargeForFlamingoCall } from "../chargeForFlamingoCall";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";

vi.mock("@/lib/credits/recordCreditDeduction", () => ({
  recordCreditDeduction: vi.fn(),
}));

describe("chargeForFlamingoCall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records an audited deduction attributed to the Modal model and the audio analyzed", async () => {
    vi.mocked(recordCreditDeduction).mockResolvedValue({ success: true });

    await chargeForFlamingoCall({
      accountId: "acc_1",
      elapsedSeconds: 30,
      costUsd: 0.02,
      audioUrl: "https://example.com/song.mp3",
    });

    // Modal's own cost wins over the seconds: 2 × $0.02 → 40,000 + the base.
    expect(recordCreditDeduction).toHaveBeenCalledWith({
      accountId: "acc_1",
      creditsToDeduct: 50_000,
      source: "api",
      provider: "modal",
      modelId: "nvidia/music-flamingo-2601-hf",
      resourceUrl: "https://example.com/song.mp3",
    });
  });

  it("charges only the base, and logs, when the response carried no cost", async () => {
    vi.mocked(recordCreditDeduction).mockResolvedValue({ success: true });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await chargeForFlamingoCall({ accountId: "acc_1", elapsedSeconds: 1.8 });

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
    expect(recordCreditDeduction).toHaveBeenCalledWith({
      accountId: "acc_1",
      creditsToDeduct: 10_000,
      source: "api",
      provider: "modal",
      modelId: "nvidia/music-flamingo-2601-hf",
    });
  });

  it("never throws: the model has already answered, so a billing hiccup is logged, not surfaced", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(recordCreditDeduction).mockRejectedValue(new Error("db down"));

    await expect(
      chargeForFlamingoCall({ accountId: "acc_1", elapsedSeconds: 3 }),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("logs when the deduction reports failure without throwing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(recordCreditDeduction).mockResolvedValue({ success: false });

    await chargeForFlamingoCall({ accountId: "acc_1", elapsedSeconds: 3 });

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
