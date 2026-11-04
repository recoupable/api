import { describe, it, expect, vi, beforeEach } from "vitest";
import { chargeForSongMeasure } from "../chargeForSongMeasure";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";

vi.mock("@/lib/credits/recordCreditDeduction", () => ({ recordCreditDeduction: vi.fn() }));

describe("chargeForSongMeasure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records the flat one-cent measurement as an audited deduction", async () => {
    vi.mocked(recordCreditDeduction).mockResolvedValue({ success: true });

    await chargeForSongMeasure({ accountId: "acc_1", audioUrl: "https://example.com/song.mp3" });

    expect(recordCreditDeduction).toHaveBeenCalledWith({
      accountId: "acc_1",
      creditsToDeduct: 10_000,
      source: "api",
      provider: "modal",
      modelId: "recoup/song-moments",
      resourceUrl: "https://example.com/song.mp3",
    });
  });

  it("logs rather than throws when the deduction fails", async () => {
    vi.mocked(recordCreditDeduction).mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      chargeForSongMeasure({ accountId: "acc_1", audioUrl: "https://example.com/song.mp3" }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
