import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { postFlamingoGenerateHandler } from "../postFlamingoGenerateHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { processAnalyzeMusicRequest } from "@/lib/flamingo/processAnalyzeMusicRequest";
import { verifyAudioUrl } from "@/lib/flamingo/verifyAudioUrl";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/plans/assertAnalyzeWithinPlan", () => ({
  assertAnalyzeWithinPlan: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/credits/ensureCreditsOrShortCircuit", () => ({
  ensureCreditsOrShortCircuit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/flamingo/processAnalyzeMusicRequest", () => ({
  processAnalyzeMusicRequest: vi.fn(),
}));
vi.mock("@/lib/flamingo/verifyAudioUrl", () => ({ verifyAudioUrl: vi.fn() }));

const AUDIO = "https://cdn.example.com/track.mp3";

function request(body: unknown): NextRequest {
  return {
    headers: new Headers({ "x-api-key": "k" }),
    json: async () => body,
  } as unknown as NextRequest;
}

describe("postFlamingoGenerateHandler — audio_url guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_1",
      orgId: null,
      authToken: "k",
    });
    vi.mocked(ensureCreditsOrShortCircuit).mockResolvedValue(null);
  });

  it("returns 400 with missing_fields [audio_url] for a prompt without audio, touching nothing", async () => {
    const res = await postFlamingoGenerateHandler(request({ prompt: "Genre?" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      status: "error",
      missing_fields: ["audio_url"],
      error: "audio_url is required",
    });
    expect(verifyAudioUrl).not.toHaveBeenCalled();
    expect(ensureCreditsOrShortCircuit).not.toHaveBeenCalled();
    expect(processAnalyzeMusicRequest).not.toHaveBeenCalled();
  });

  it("returns the documented 422 before the credit gate when the URL is not audio", async () => {
    vi.mocked(verifyAudioUrl).mockResolvedValue({
      ok: false,
      error: "audio_url_not_audio",
      message: "audio_url answered 200 with content type text/html",
    });

    const res = await postFlamingoGenerateHandler(
      request({ preset: "mood_tags", audio_url: AUDIO }),
    );

    expect(res.status).toBe(422);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toEqual({
      status: "error",
      error: "audio_url_not_audio",
      message: "audio_url answered 200 with content type text/html",
    });
    expect(verifyAudioUrl).toHaveBeenCalledWith(AUDIO);
    expect(ensureCreditsOrShortCircuit).not.toHaveBeenCalled();
    expect(processAnalyzeMusicRequest).not.toHaveBeenCalled();
  });

  it("returns 422 audio_url_unreachable for a dead URL, before the credit gate", async () => {
    vi.mocked(verifyAudioUrl).mockResolvedValue({
      ok: false,
      error: "audio_url_unreachable",
      message: "audio_url answered HTTP 404",
    });

    const res = await postFlamingoGenerateHandler(request({ prompt: "Genre?", audio_url: AUDIO }));

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: "audio_url_unreachable" });
    expect(ensureCreditsOrShortCircuit).not.toHaveBeenCalled();
  });

  it("verifies full_report once, then gates and runs the analysis", async () => {
    vi.mocked(verifyAudioUrl).mockResolvedValue({ ok: true, contentType: "audio/mpeg" });
    vi.mocked(processAnalyzeMusicRequest).mockResolvedValue({
      type: "success",
      preset: "full_report",
      report: {},
      elapsed_seconds: 40,
    });

    const res = await postFlamingoGenerateHandler(
      request({ preset: "full_report", audio_url: AUDIO }),
    );

    expect(res.status).toBe(200);
    expect(verifyAudioUrl).toHaveBeenCalledTimes(1);
    expect(ensureCreditsOrShortCircuit).toHaveBeenCalledTimes(1);
    expect(processAnalyzeMusicRequest).toHaveBeenCalledWith(
      expect.objectContaining({ preset: "full_report", audio_url: AUDIO }),
      { accountId: "acc_1" },
    );
  });
});
