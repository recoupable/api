import { describe, it, expect, vi, beforeEach } from "vitest";
import { chargeForFlamingoBatch } from "../chargeForFlamingoBatch";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";

vi.mock("@/lib/credits/recordCreditDeduction", () => ({
  recordCreditDeduction: vi.fn(),
}));

describe("chargeForFlamingoBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records one audited deduction for the whole batch, with the same ledger fields as a single call", async () => {
    vi.mocked(recordCreditDeduction).mockResolvedValue({ success: true });

    await chargeForFlamingoBatch({
      accountId: "acc_1",
      elapsedSeconds: 90,
      promptCount: 36,
      audioUrl: "https://example.com/song.mp3",
    });

    expect(recordCreditDeduction).toHaveBeenCalledTimes(1);
    expect(recordCreditDeduction).toHaveBeenCalledWith({
      accountId: "acc_1",
      creditsToDeduct: 154_940,
      source: "api",
      provider: "modal",
      modelId: "nvidia/music-flamingo-2601-hf",
      resourceUrl: "https://example.com/song.mp3",
    });
  });

  it("omits resource_url when no audio URL is to be recorded", async () => {
    vi.mocked(recordCreditDeduction).mockResolvedValue({ success: true });

    await chargeForFlamingoBatch({ accountId: "acc_1", elapsedSeconds: 0, promptCount: 2 });

    expect(recordCreditDeduction).toHaveBeenCalledWith({
      accountId: "acc_1",
      creditsToDeduct: 50_000,
      source: "api",
      provider: "modal",
      modelId: "nvidia/music-flamingo-2601-hf",
    });
  });

  it("never throws, and logs the prompt count, when the deduction throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(recordCreditDeduction).mockRejectedValue(new Error("db down"));

    await expect(
      chargeForFlamingoBatch({ accountId: "acc_1", elapsedSeconds: 3, promptCount: 5 }),
    ).resolves.toBeUndefined();
    expect(String(errorSpy.mock.calls[0][0])).toContain("5 prompts");
    errorSpy.mockRestore();
  });

  it("logs when the deduction reports failure without throwing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(recordCreditDeduction).mockResolvedValue({ success: false });

    await chargeForFlamingoBatch({ accountId: "acc_1", elapsedSeconds: 3, promptCount: 1 });

    expect(String(errorSpy.mock.calls[0][0])).toContain("1 prompt");
    errorSpy.mockRestore();
  });
});
