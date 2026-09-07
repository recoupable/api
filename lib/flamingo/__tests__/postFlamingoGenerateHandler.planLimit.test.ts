import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { postFlamingoGenerateHandler } from "../postFlamingoGenerateHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { processAnalyzeMusicRequest } from "@/lib/flamingo/processAnalyzeMusicRequest";
import { assertAnalyzeWithinPlan } from "@/lib/plans/assertAnalyzeWithinPlan";
import { PlanLimitError } from "@/lib/plans/PlanLimitError";
import { buildAnalyzePlanLimitBody } from "@/lib/plans/buildAnalyzePlanLimitBody";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/flamingo/verifyAudioUrl", () => ({
  verifyAudioUrl: vi.fn().mockResolvedValue({ ok: true, contentType: "audio/mpeg" }),
}));
vi.mock("@/lib/credits/ensureCreditsOrShortCircuit", () => ({
  ensureCreditsOrShortCircuit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/flamingo/processAnalyzeMusicRequest", () => ({
  processAnalyzeMusicRequest: vi.fn(),
}));
vi.mock("@/lib/plans/assertAnalyzeWithinPlan", () => ({ assertAnalyzeWithinPlan: vi.fn() }));

const AUDIO = "https://cdn.example.com/track.mp3";
const request = (body: unknown): NextRequest =>
  ({
    headers: new Headers({ "x-api-key": "k" }),
    json: async () => body,
  }) as unknown as NextRequest;

describe("postFlamingoGenerateHandler — plan gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_1",
      orgId: null,
      authToken: "k",
    });
    vi.mocked(ensureCreditsOrShortCircuit).mockResolvedValue(null);
  });

  it("returns the documented 402 plan_limit before the credit gate and never calls the model", async () => {
    const body = buildAnalyzePlanLimitBody({ plan: "free", currentAnalyzeCount: 5 });
    vi.mocked(assertAnalyzeWithinPlan).mockRejectedValue(new PlanLimitError(body));

    const res = await postFlamingoGenerateHandler(
      request({ preset: "mood_tags", audio_url: AUDIO }),
    );

    expect(res.status).toBe(402);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toEqual(body);
    expect(assertAnalyzeWithinPlan).toHaveBeenCalledWith({ accountId: "acc_1", audioUrl: AUDIO });
    expect(ensureCreditsOrShortCircuit).not.toHaveBeenCalled();
    expect(processAnalyzeMusicRequest).not.toHaveBeenCalled();
  });

  it("answers a thrown plan lookup with a 500 and never calls the model", async () => {
    vi.mocked(assertAnalyzeWithinPlan).mockRejectedValue(new Error("stripe down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await postFlamingoGenerateHandler(
      request({ preset: "mood_tags", audio_url: AUDIO }),
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
    expect(processAnalyzeMusicRequest).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("proceeds to the credit gate and the model when the plan allows it", async () => {
    vi.mocked(assertAnalyzeWithinPlan).mockResolvedValue(undefined);
    vi.mocked(processAnalyzeMusicRequest).mockResolvedValue({
      type: "success",
      preset: "mood_tags",
      response: ["warm"],
      elapsed_seconds: 2,
    });

    const res = await postFlamingoGenerateHandler(
      request({ preset: "mood_tags", audio_url: AUDIO }),
    );

    expect(res.status).toBe(200);
    expect(ensureCreditsOrShortCircuit).toHaveBeenCalledTimes(1);
  });
});
