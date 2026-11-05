import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { postSongMomentsHandler } from "../postSongMomentsHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { verifyAudioUrl } from "@/lib/flamingo/verifyAudioUrl";
import { processSongMomentsRequest } from "@/lib/songMoments/processSongMomentsRequest";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: vi.fn(() => ({})) }));
vi.mock("@/lib/flamingo/verifyAudioUrl", () => ({ verifyAudioUrl: vi.fn() }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/credits/ensureCreditsOrShortCircuit", () => ({
  ensureCreditsOrShortCircuit: vi.fn(),
}));
vi.mock("@/lib/songMoments/processSongMomentsRequest", () => ({
  processSongMomentsRequest: vi.fn(),
}));

function request(body: unknown): NextRequest {
  return {
    headers: new Headers({ "x-api-key": "k" }),
    json: async () => body,
  } as unknown as NextRequest;
}

const measured = {
  measured_with: "song-moments-2026-11-04",
  duration_seconds: 180,
  tempo_bpm: 120,
  loudness_lufs: -9,
  ending: "cold" as const,
  names_from: "audio" as const,
  sections: [],
  moments: [],
  energy_curve: [],
  elapsed_seconds: 4,
};

describe("postSongMomentsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_1",
      orgId: null,
      authToken: "k",
    });
    vi.mocked(verifyAudioUrl).mockResolvedValue({ ok: true, contentType: "audio/mpeg" });
    vi.mocked(ensureCreditsOrShortCircuit).mockResolvedValue(null);
    vi.mocked(processSongMomentsRequest).mockResolvedValue(measured);
  });

  it("gates on the measurement plus one model base fee, then returns the measured song flat", async () => {
    const res = await postSongMomentsHandler(
      request({ audio_url: "https://example.com/song.mp3" }),
    );

    expect(ensureCreditsOrShortCircuit).toHaveBeenCalledWith({
      accountId: "acc_1",
      creditsToDeduct: 60_000,
    });
    expect(processSongMomentsRequest).toHaveBeenCalledWith(
      { audio_url: "https://example.com/song.mp3", describe: true },
      { accountId: "acc_1" },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success", ...measured });
  });

  it("returns the 402 when the balance is short, without measuring", async () => {
    vi.mocked(ensureCreditsOrShortCircuit).mockResolvedValue(
      NextResponse.json({}, { status: 402 }),
    );

    const res = await postSongMomentsHandler(
      request({ audio_url: "https://example.com/song.mp3" }),
    );

    expect(res.status).toBe(402);
    expect(processSongMomentsRequest).not.toHaveBeenCalled();
  });

  it("returns 400 with missing_fields for a bad body", async () => {
    const res = await postSongMomentsHandler(request({ describe: "yes" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ status: "error", missing_fields: ["audio_url"] });
  });

  it("returns 422 when the URL is not audio, before any credit check", async () => {
    vi.mocked(verifyAudioUrl).mockResolvedValue({
      ok: false,
      error: "audio_url_not_audio",
      message: "audio_url answered 200 with content type text/html",
    });

    const res = await postSongMomentsHandler(request({ audio_url: "https://example.com/page" }));

    expect(res.status).toBe(422);
    expect(ensureCreditsOrShortCircuit).not.toHaveBeenCalled();
  });

  it("returns 500 with the reason when the measurement fails", async () => {
    vi.mocked(processSongMomentsRequest).mockRejectedValue(
      new Error("Song measurement failed (status 422)"),
    );

    const res = await postSongMomentsHandler(
      request({ audio_url: "https://example.com/song.mp3" }),
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Song measurement failed (status 422)",
    });
  });
});
