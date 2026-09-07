import { describe, it, expect, vi, beforeEach } from "vitest";
import { gateAnalyzeForTool } from "../gateAnalyzeForTool";
import { assertAnalyzeWithinPlan } from "@/lib/plans/assertAnalyzeWithinPlan";
import { checkCreditsAvailable } from "@/lib/credits/checkCreditsAvailable";
import { PlanLimitError } from "@/lib/plans/PlanLimitError";
import { buildAnalyzePlanLimitBody } from "@/lib/plans/buildAnalyzePlanLimitBody";

vi.mock("@/lib/plans/assertAnalyzeWithinPlan", () => ({ assertAnalyzeWithinPlan: vi.fn() }));
vi.mock("@/lib/credits/checkCreditsAvailable", () => ({ checkCreditsAvailable: vi.fn() }));

const AUDIO = "https://cdn.example.com/track.mp3";
const args = { preset: "mood_tags", audio_url: AUDIO } as never;
const text = (r: { content: { text: string }[] } | null) =>
  r ? JSON.parse(r.content[0].text) : null;

describe("gateAnalyzeForTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertAnalyzeWithinPlan).mockResolvedValue(undefined);
    vi.mocked(checkCreditsAvailable).mockResolvedValue({ kind: "ok" } as never);
  });

  it("returns null when both gates pass, having checked the plan first", async () => {
    expect(await gateAnalyzeForTool("acc_1", args)).toBeNull();
    expect(assertAnalyzeWithinPlan).toHaveBeenCalledWith({ accountId: "acc_1", audioUrl: AUDIO });
    expect(checkCreditsAvailable).toHaveBeenCalledTimes(1);
  });

  it("returns the plan-limit message and skips the credit gate", async () => {
    vi.mocked(assertAnalyzeWithinPlan).mockRejectedValue(
      new PlanLimitError(buildAnalyzePlanLimitBody({ plan: "free", currentAnalyzeCount: 5 })),
    );
    expect(text(await gateAnalyzeForTool("acc_1", args))).toEqual({
      success: false,
      message: "Free includes 5 tracks analyzed a month. Starter and Pro are unlimited.",
    });
    expect(checkCreditsAvailable).not.toHaveBeenCalled();
  });

  it("names the plan lookup when it throws", async () => {
    vi.mocked(assertAnalyzeWithinPlan).mockRejectedValue(new Error("stripe down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(text(await gateAnalyzeForTool("acc_1", args))).toEqual({
      success: false,
      message: "Plan check failed",
    });
    errorSpy.mockRestore();
  });

  it("returns the insufficient-credits message with the numbers", async () => {
    vi.mocked(checkCreditsAvailable).mockResolvedValue({
      kind: "insufficient_credits",
      remainingCredits: 10,
      requiredCredits: 50000,
    } as never);
    expect(text(await gateAnalyzeForTool("acc_1", args))).toEqual({
      success: false,
      message: "Insufficient credits: 10 remaining, 50000 required",
    });
  });

  it("names the credit check when it throws", async () => {
    vi.mocked(checkCreditsAvailable).mockRejectedValue(new Error("db down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(text(await gateAnalyzeForTool("acc_1", args))).toEqual({
      success: false,
      message: "Credit check failed",
    });
    errorSpy.mockRestore();
  });
});
