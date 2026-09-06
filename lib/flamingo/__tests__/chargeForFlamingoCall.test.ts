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
      audioUrl: "https://example.com/song.mp3",
    });

    expect(recordCreditDeduction).toHaveBeenCalledWith({
      accountId: "acc_1",
      creditsToDeduct: 44_980,
      source: "api",
      provider: "modal",
      modelId: "nvidia/music-flamingo-2601-hf",
      resourceUrl: "https://example.com/song.mp3",
    });
  });

  it("charges base plus seconds and omits resource_url for a prompt with no audio", async () => {
    vi.mocked(recordCreditDeduction).mockResolvedValue({ success: true });

    await chargeForFlamingoCall({ accountId: "acc_1", elapsedSeconds: 1.8 });

    // 1.8 × 0.001166 = $0.0020988 → 2,099 + the 10,000 base.
    expect(recordCreditDeduction).toHaveBeenCalledWith({
      accountId: "acc_1",
      creditsToDeduct: 12_099,
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
