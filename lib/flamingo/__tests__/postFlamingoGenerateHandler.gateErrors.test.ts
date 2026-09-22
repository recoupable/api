import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { postFlamingoGenerateHandler } from "../postFlamingoGenerateHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { processAnalyzeMusicRequest } from "@/lib/flamingo/processAnalyzeMusicRequest";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
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

describe("postFlamingoGenerateHandler — gate failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_1",
      orgId: null,
      authToken: "k",
    });
  });

  it("answers a thrown gate with a CORS-bearing 500 and never calls the model", async () => {
    vi.mocked(ensureCreditsOrShortCircuit).mockRejectedValue(new Error("db down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await postFlamingoGenerateHandler({
      headers: new Headers({ "x-api-key": "k" }),
      json: async () => ({ prompt: "Genre?", audio_url: "https://example.com/song.mp3" }),
    } as unknown as NextRequest);

    expect(res.status).toBe(500);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
    expect(processAnalyzeMusicRequest).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("validates the body before touching the balance", async () => {
    const res = await postFlamingoGenerateHandler({
      headers: new Headers({ "x-api-key": "k" }),
      json: async () => ({}),
    } as unknown as NextRequest);

    expect(res.status).toBe(400);
    expect(ensureCreditsOrShortCircuit).not.toHaveBeenCalled();
  });
});
