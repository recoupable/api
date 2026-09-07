import { describe, it, expect, vi, beforeEach } from "vitest";
import { processAnalyzeMusicRequest } from "../processAnalyzeMusicRequest";
import { chargeForFlamingoCall } from "@/lib/flamingo/chargeForFlamingoCall";
import { callFlamingoGenerate } from "@/lib/flamingo/callFlamingoGenerate";
import { executeFullReport } from "@/lib/flamingo/executeFullReport";

vi.mock("@/lib/flamingo/callFlamingoGenerate", () => ({ callFlamingoGenerate: vi.fn() }));
vi.mock("@/lib/flamingo/chargeForFlamingoCall", () => ({ chargeForFlamingoCall: vi.fn() }));
vi.mock("@/lib/flamingo/executeFullReport", () => ({ executeFullReport: vi.fn() }));

const base = { max_new_tokens: 512, temperature: 1.0, top_p: 1.0, do_sample: false };

describe("processAnalyzeMusicRequest — credits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chargeForFlamingoCall).mockResolvedValue(undefined);
  });

  it("charges the account once for a single model call, on the model's own seconds", async () => {
    vi.mocked(callFlamingoGenerate).mockResolvedValue({ response: "jazz", elapsed_seconds: 2.4 });

    const result = await processAnalyzeMusicRequest(
      { ...base, prompt: "Genre?", audio_url: "https://example.com/song.mp3" },
      { accountId: "acc_1" },
    );

    expect(result.type).toBe("success");
    expect(chargeForFlamingoCall).toHaveBeenCalledTimes(1);
    expect(chargeForFlamingoCall).toHaveBeenCalledWith({
      accountId: "acc_1",
      elapsedSeconds: 2.4,
      audioUrl: "https://example.com/song.mp3",
    });
  });

  it("charges nothing when the model call throws", async () => {
    vi.mocked(callFlamingoGenerate).mockRejectedValue(
      new Error("Music analysis failed (status 503)"),
    );

    await expect(
      processAnalyzeMusicRequest(
        { ...base, prompt: "Genre?", audio_url: "https://example.com/song.mp3" },
        { accountId: "acc_1" },
      ),
    ).rejects.toThrow();
    expect(chargeForFlamingoCall).not.toHaveBeenCalled();
  });

  it("charges nothing for a validation error that never reaches the model", async () => {
    const result = await processAnalyzeMusicRequest(
      { ...base, preset: "not_a_preset", audio_url: "https://example.com/song.mp3" },
      { accountId: "acc_1" },
    );

    expect(result.type).toBe("error");
    expect(chargeForFlamingoCall).not.toHaveBeenCalled();
    expect(callFlamingoGenerate).not.toHaveBeenCalled();
  });

  it("hands the account to executeFullReport, which charges per section", async () => {
    vi.mocked(executeFullReport).mockResolvedValue({ report: {}, elapsed_seconds: 12 });

    await processAnalyzeMusicRequest(
      { ...base, preset: "full_report", audio_url: "https://example.com/song.mp3" },
      { accountId: "acc_1" },
    );

    expect(executeFullReport).toHaveBeenCalledWith("https://example.com/song.mp3", "acc_1");
    // The single-call charge must not double up on top of the per-section ones.
    expect(chargeForFlamingoCall).not.toHaveBeenCalled();
  });
});
