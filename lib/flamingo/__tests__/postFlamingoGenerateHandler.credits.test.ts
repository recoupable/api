import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { postFlamingoGenerateHandler } from "../postFlamingoGenerateHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { processAnalyzeMusicRequest } from "@/lib/flamingo/processAnalyzeMusicRequest";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: vi.fn(() => ({})) }));
vi.mock("@/lib/flamingo/verifyAudioUrl", () => ({
  verifyAudioUrl: vi.fn().mockResolvedValue({ ok: true, contentType: "audio/mpeg" }),
}));

vi.mock("@/lib/plans/assertAnalyzeWithinPlan", () => ({
  assertAnalyzeWithinPlan: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/credits/ensureCreditsOrShortCircuit", () => ({
  ensureCreditsOrShortCircuit: vi.fn(),
}));
vi.mock("@/lib/flamingo/processAnalyzeMusicRequest", () => ({
  processAnalyzeMusicRequest: vi.fn(),
}));

function request(body: Record<string, unknown>): NextRequest {
  return {
    headers: new Headers({ "x-api-key": "k" }),
    json: async () => body,
  } as unknown as NextRequest;
}

describe("postFlamingoGenerateHandler — credit gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_1",
      orgId: null,
      authToken: "k",
    });
  });

  it("gates a single call on one floor and runs the analysis for that account", async () => {
    vi.mocked(ensureCreditsOrShortCircuit).mockResolvedValue(null);
    vi.mocked(processAnalyzeMusicRequest).mockResolvedValue({
      type: "success",
      response: "jazz",
      elapsed_seconds: 2,
    });

    const res = await postFlamingoGenerateHandler(
      request({ prompt: "Genre?", audio_url: "https://example.com/song.mp3" }),
    );

    expect(res.status).toBe(200);
    expect(ensureCreditsOrShortCircuit).toHaveBeenCalledWith({
      accountId: "acc_1",
      creditsToDeduct: 50_000,
    });
    expect(processAnalyzeMusicRequest).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "Genre?" }),
      { accountId: "acc_1" },
    );
  });

  it("gates full_report on one floor per section", async () => {
    vi.mocked(ensureCreditsOrShortCircuit).mockResolvedValue(null);
    vi.mocked(processAnalyzeMusicRequest).mockResolvedValue({
      type: "success",
      preset: "full_report",
      report: {},
      elapsed_seconds: 20,
    });

    await postFlamingoGenerateHandler(
      request({ preset: "full_report", audio_url: "https://example.com/song.mp3" }),
    );

    expect(ensureCreditsOrShortCircuit).toHaveBeenCalledWith({
      accountId: "acc_1",
      creditsToDeduct: 650_000,
    });
  });

  it("returns the gate's 402 and never calls the model when credits are short", async () => {
    const short = NextResponse.json(
      {
        error: "insufficient_credits",
        remaining_credits: 0,
        required_credits: 50_000,
        billingUrl: "https://app.recoupable.dev",
      },
      { status: 402 },
    );
    vi.mocked(ensureCreditsOrShortCircuit).mockResolvedValue(short);

    const res = await postFlamingoGenerateHandler(
      request({ prompt: "Genre?", audio_url: "https://example.com/song.mp3" }),
    );

    expect(res.status).toBe(402);
    expect(await res.json()).toEqual(
      expect.objectContaining({ error: "insufficient_credits", required_credits: 50_000 }),
    );
    expect(processAnalyzeMusicRequest).not.toHaveBeenCalled();
  });
});
