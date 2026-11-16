import { describe, it, expect, vi, beforeEach } from "vitest";
import { chargeForBatchAnswers } from "../chargeForBatchAnswers";
import { chargeForFlamingoBatch } from "@/lib/flamingo/chargeForFlamingoBatch";

vi.mock("@/lib/flamingo/chargeForFlamingoBatch", () => ({ chargeForFlamingoBatch: vi.fn() }));

describe("chargeForBatchAnswers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chargeForFlamingoBatch).mockResolvedValue(undefined);
  });

  it("charges one batch on the seconds of the answers that were used", async () => {
    await chargeForBatchAnswers({
      accountId: "acc_1",
      answers: [{ elapsed_seconds: 4.5 }, { elapsed_seconds: 2.25 }],
      audioUrl: "https://example.com/song.mp3",
    });

    expect(chargeForFlamingoBatch).toHaveBeenCalledTimes(1);
    expect(chargeForFlamingoBatch).toHaveBeenCalledWith({
      accountId: "acc_1",
      elapsedSeconds: 6.75,
      promptCount: 2,
      audioUrl: "https://example.com/song.mp3",
    });
  });

  it("charges nothing when no answer was usable", async () => {
    await chargeForBatchAnswers({ accountId: "acc_1", answers: [] });

    expect(chargeForFlamingoBatch).not.toHaveBeenCalled();
  });

  it("leaves the audio URL off the usage record when none is given", async () => {
    await chargeForBatchAnswers({ accountId: "acc_1", answers: [{ elapsed_seconds: 3 }] });

    expect(chargeForFlamingoBatch).toHaveBeenCalledWith({
      accountId: "acc_1",
      elapsedSeconds: 3,
      promptCount: 1,
    });
  });
});
